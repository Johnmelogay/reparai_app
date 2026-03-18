// supabase/functions/analyze-request/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const clamp01 = (value: unknown, fallback: number = 0.5): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
};

const isNonEmptyText = (value: unknown): boolean =>
    typeof value === 'string' && value.trim().length > 0;

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

function computeConfidence(aiJson: any, answers: Record<string, string>) {
    const modelConfidence = clamp01(aiJson?.confidence, 0.5);
    const answeredCount = Object.values(answers || {}).filter((v) => isNonEmptyText(v)).length;
    const answerCoverage = Math.min(answeredCount / 5, 1);

    const taxonomyCompleteness = [
        isNonEmptyText(aiJson?.asset_type),
        isNonEmptyText(aiJson?.service_type),
        Array.isArray(aiJson?.issue_tags) && aiJson.issue_tags.length > 0,
        isNonEmptyText(aiJson?.problem_guess),
    ].filter(Boolean).length / 4;

    const summaryLength = typeof aiJson?.summary_for_provider === 'string'
        ? aiJson.summary_for_provider.trim().length
        : 0;
    const summaryQuality = summaryLength >= 24 ? 1 : summaryLength > 0 ? 0.5 : 0;

    // Calibrated confidence:
    // - model self-confidence is relevant but not enough
    // - we require enough user answers and valid taxonomy fields
    const finalConfidence =
        (modelConfidence * 0.5) +
        (answerCoverage * 0.25) +
        (taxonomyCompleteness * 0.2) +
        (summaryQuality * 0.05);

    return {
        confidence: round4(clamp01(finalConfidence, 0.45)),
        factors: {
            model_confidence: round4(modelConfidence),
            answer_coverage: round4(answerCoverage),
            taxonomy_completeness: round4(taxonomyCompleteness),
            summary_quality: round4(summaryQuality),
            answered_count: answeredCount,
        }
    };
}

Deno.serve(async (req) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        const { requestId, category, answers, userText, lat, lng } = await req.json();

        // category now contains the domain slug (mobilidade, casa, tecnologia)
        const domain = category;

        // 1. Setup Clients
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

        // 2. AI Analysis (Gemini) - NOW RETURNS 3D TAXONOMY
        const systemPrompt = `Você é um especialista em diagnóstico de manutenções. 
SUA TAREFA CRÍTICA: Retornar uma TAXONOMIA ESTRUTURADA (3 dimensões) para matching preciso de prestadores.

Retorne APENAS JSON no formato exato abaixo.`;

        const userPrompt = `Analise este pedido no domínio "${domain}":
Respostas do Funil: ${JSON.stringify(answers)}
Texto do Usuário: ${userText || 'N/A'}

**IDENTIFIQUE COM PRECISÃO:**

1. **asset_type** (string): O equipamento/objeto EXATO.
   - Se mobilidade: "carro", "moto", "bicicleta", "patinete"
   - Se casa: "ar_condicionado", "geladeira", "chuveiro", "pia", "vaso", "portao", "janela"
   - Se tecnologia: "tv", "celular", "notebook", "impressora"

2. **service_type** (string): O tipo de serviço TÉCNICO.
   - "mecanica" (motor, peças mecânicas)
   - "eletrica" (fiação, tomadas, circuitos)
   - "hidraulica" (água, encanamento)
   - "instalacao" (montar, instalar)
   - "manutencao" (preventiva, limpeza)
   - "diagnostico" (avaliar)

3. **issue_tags** (array): Tags ESPECÍFICAS do problema (max 5).
   Exemplos: ["bateria", "descarrega"], ["corrente", "folga"], ["vazamento", "pia"]

4. **problem_guess** (string): Resumo curto 3-5 palavras.

5. **confidence** (number 0-1): Sua certeza na identificação.

6. **summary_for_provider** (string): Parágrafo técnico (max 200 chars).

**RETORNE JSON:**
{
  "domain": "${domain}",
  "asset_type": "bicicleta",
  "service_type": "mecanica",
  "issue_tags": ["corrente", "folga"],
  "problem_guess": "Corrente solta/barulho",
  "confidence": 0.85,
  "summary_for_provider": "Cliente relata corrente da bicicleta com folga. Pode precisar ajuste ou substituição."
}`

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\n${userPrompt}`
                    }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", data);
            throw new Error(`Gemini API Error (${response.status}): ${JSON.stringify(data)}`);
        }

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
            throw new Error("No content from Gemini");
        }

        // Clean markdown if present
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiJson = JSON.parse(cleanContent);
        const { confidence, factors } = computeConfidence(aiJson, answers || {});
        aiJson.confidence_model = clamp01(aiJson.confidence, 0.5);
        aiJson.confidence = confidence;
        aiJson.confidence_factors = factors;

        // 3. Find Providers (GIS)
        let providers = [];
        if (lat && lng) {
            const { data: nearbyProviders, error: rpcError } = await supabase.rpc('find_nearby_providers', {
                user_lat: lat,
                user_lng: lng,
                category_filter: category,
                radius_km: 15
            });

            if (!rpcError) {
                providers = nearbyProviders || [];
            } else {
                console.error("RPC Error:", rpcError);
            }
        }

        // 4. Update Request with 3D TAXONOMY
        if (requestId) {
            await supabase.from('requests').update({
                ai_result_json: aiJson,
                status: 'finding',
                // NEW: 3D Taxonomy fields for deterministic matching
                domain_slug: aiJson.domain || domain,
                asset_slug: aiJson.asset_type,
                service_type_slug: aiJson.service_type,
                issue_tags: aiJson.issue_tags || []
            }).eq('id', requestId);
        }

        return new Response(JSON.stringify({
            analysis: aiJson,
            providers: providers.slice(0, 5)
        }), {
            headers: {
                "Content-Type": "application/json",
                'Access-Control-Allow-Origin': '*',
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
});
