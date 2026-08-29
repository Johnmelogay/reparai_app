// supabase/functions/analyze-request/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TaxonomyAnalysis {
    domain: string;
    asset_type: string;
    service_type: string;
    issue_tags: string[];
    problem_guess: string;
    confidence: number;
    summary_for_provider: string;
    source: "gemini" | "deterministic_fallback";
    degraded: boolean;
}

function getDeterministicTaxonomy(category: string, answers: Record<string, string> = {}, userText: string = ''): TaxonomyAnalysis {
    const domain = (category || 'mobilidade').toLowerCase();
    const allText = `${Object.values(answers || {}).join(' ')} ${userText}`.toLowerCase();

    let asset_type = 'veiculo';
    let service_type = 'mecanica';
    const issue_tags: string[] = [];

    if (domain.includes('mobilidade')) {
        if (allText.includes('moto')) asset_type = 'moto';
        else if (allText.includes('bicicleta') || allText.includes('bike')) asset_type = 'bicicleta';
        else if (allText.includes('patinete')) asset_type = 'patinete';
        else asset_type = 'carro';

        if (allText.includes('bateria') || allText.includes('eletric') || allText.includes('luz')) {
            service_type = 'eletrica';
            issue_tags.push('eletrica', 'bateria');
        } else if (allText.includes('freio') || allText.includes('pneu') || allText.includes('roda')) {
            service_type = 'freios';
            issue_tags.push('freios', 'suspensao');
        } else if (allText.includes('ar') || allText.includes('clima')) {
            service_type = 'ar_condicionado';
            issue_tags.push('ar_condicionado');
        } else {
            service_type = 'mecanica';
            issue_tags.push('motor', 'mecanica');
        }
    } else if (domain.includes('casa')) {
        if (allText.includes('ar') || allText.includes('split')) asset_type = 'ar_condicionado';
        else if (allText.includes('geladeira') || allText.includes('freezer')) asset_type = 'geladeira';
        else if (allText.includes('lavar') || allText.includes('maquina')) asset_type = 'maquina_lavar';
        else if (allText.includes('pia') || allText.includes('cano') || allText.includes('vazamento')) asset_type = 'encanamento';
        else asset_type = 'instalacao';

        if (allText.includes('vazamento') || allText.includes('agua')) {
            service_type = 'hidraulica';
            issue_tags.push('vazamento', 'agua');
        } else if (allText.includes('curto') || allText.includes('tomada') || allText.includes('disjuntor')) {
            service_type = 'eletrica';
            issue_tags.push('eletrica', 'curto');
        } else {
            service_type = 'manutencao';
            issue_tags.push('conserto', 'geral');
        }
    } else {
        // Tecnologia
        if (allText.includes('celular') || allText.includes('smartphone') || allText.includes('iphone')) asset_type = 'celular';
        else if (allText.includes('notebook') || allText.includes('computador') || allText.includes('pc')) asset_type = 'computador';
        else if (allText.includes('tv') || allText.includes('televis')) asset_type = 'tv';
        else asset_type = 'dispositivo';

        if (allText.includes('tela') || allText.includes('display')) {
            service_type = 'hardware';
            issue_tags.push('tela', 'troca_display');
        } else if (allText.includes('bateria') || allText.includes('carreg')) {
            service_type = 'bateria';
            issue_tags.push('bateria', 'alimentacao');
        } else {
            service_type = 'reparo';
            issue_tags.push('eletronica', 'conserto');
        }
    }

    const problem_guess = userText ? userText.slice(0, 40) : `Reparo em ${asset_type}`;
    const summary_for_provider = `Cliente solicita atendimento para ${asset_type} (${service_type}). Sintomas informados: ${userText || 'Verificar no local'}.`;

    return {
        domain: domain,
        asset_type: asset_type,
        service_type: service_type,
        issue_tags: issue_tags,
        problem_guess: problem_guess,
        confidence: 0.88,
        summary_for_provider: summary_for_provider.slice(0, 200),
        source: "deterministic_fallback",
        degraded: true
    };
}

const jsonResponse = (data: any, status: number = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
    });
};

Deno.serve(async (req) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'method_not_allowed' }, 405);
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing Supabase configuration in environment");
            return jsonResponse({ error: "server_misconfiguration" }, 500);
        }

        // 1. Authenticate user from JWT
        const authHeader = req.headers.get('Authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
            return jsonResponse({ error: "unauthorized", message: "Missing or invalid Authorization header" }, 401);
        }

        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return jsonResponse({ error: "unauthorized", message: "Empty Bearer token" }, 401);
        }

        // Create auth-verifying client using anon key and token
        const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);
        const { data: userData, error: userError } = await authClient.auth.getUser(token);

        if (userError || !userData?.user?.id) {
            return jsonResponse({ error: "unauthorized", message: "Invalid or expired user token" }, 401);
        }

        const callerUid = userData.user.id;

        // 2. Validate Body & requestId
        let body: any;
        try {
            body = await req.json();
        } catch {
            return jsonResponse({ error: "bad_request", message: "Invalid JSON payload" }, 400);
        }

        const { requestId, category = 'mobilidade', answers = {}, userText = '', lat, lng } = body || {};

        if (!requestId || typeof requestId !== 'string' || !UUID_REGEX.test(requestId)) {
            return jsonResponse({
                error: "bad_request",
                message: "A valid UUID requestId is required."
            }, 400);
        }

        const domain = category;
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

        // 3. Verify request exists and caller is owner
        const { data: requestRow, error: fetchError } = await serviceClient
            .from('requests')
            .select('id, user_id, ai_result_json, status')
            .eq('id', requestId)
            .single();

        if (fetchError || !requestRow) {
            return jsonResponse({
                error: "not_found",
                message: "Request not found"
            }, 404);
        }

        if (requestRow.user_id !== callerUid) {
            return jsonResponse({
                error: "forbidden",
                message: "You are not the owner of this request"
            }, 403);
        }

        // 4. Idempotency check: If already analyzed, return cached analysis immediately
        if (requestRow.ai_result_json?.asset_type) {
            console.log(`⚡ [analyze-request] Idempotent hit: request ${requestId} already analyzed`);
            return jsonResponse({
                analysis: requestRow.ai_result_json,
                idempotent: true,
                source: requestRow.ai_result_json.source || "cached",
                degraded: Boolean(requestRow.ai_result_json.degraded)
            }, 200);
        }

        // 5. Execute AI or Deterministic Fallback
        let aiJson: TaxonomyAnalysis | null = null;
        let usedSource: "gemini" | "deterministic_fallback" = "deterministic_fallback";
        let isDegraded = true;

        const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");

        if (apiKey) {
            try {
                const systemPrompt = `Você é um especialista em diagnóstico de manutenções. 
SUA TAREFA: Retornar uma TAXONOMIA ESTRUTURADA (3 dimensões: domain, asset_type, service_type, issue_tags, problem_guess, confidence, summary_for_provider).
Retorne APENAS JSON.`;

                const userPrompt = `Analise este pedido no domínio "${domain}":
Respostas do Funil: ${JSON.stringify(answers)}
Texto do Usuário: ${userText || 'N/A'}

Retorne JSON no formato:
{
  "domain": "${domain}",
  "asset_type": "carro",
  "service_type": "mecanica",
  "issue_tags": ["motor", "ignicao"],
  "problem_guess": "Motor não dá partida",
  "confidence": 0.85,
  "summary_for_provider": "Cliente relata veículo que não liga."
}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                    method: "POST",
                    signal: controller.signal,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (content) {
                        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanContent);
                        if (parsed?.asset_type) {
                            aiJson = {
                                domain: parsed.domain || domain,
                                asset_type: parsed.asset_type,
                                service_type: parsed.service_type || 'geral',
                                issue_tags: Array.isArray(parsed.issue_tags) ? parsed.issue_tags : [],
                                problem_guess: parsed.problem_guess || 'Reparo solicitado',
                                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
                                summary_for_provider: parsed.summary_for_provider || 'Análise de serviço',
                                source: "gemini",
                                degraded: false
                            };
                            usedSource = "gemini";
                            isDegraded = false;
                        }
                    }
                }
            } catch (geminiErr) {
                console.warn("⚠️ [analyze-request] Upstream Gemini failed, falling back gracefully:", geminiErr);
            }
        }

        // Deterministic Fallback if Gemini unavailable or failed
        if (!aiJson) {
            aiJson = getDeterministicTaxonomy(domain, answers, userText);
            usedSource = "deterministic_fallback";
            isDegraded = true;
        }

        // 6. Update Request with 3D Taxonomy exclusively for this verified requestId
        const { error: updateError } = await serviceClient
            .from('requests')
            .update({
                ai_result_json: aiJson,
                domain_slug: aiJson.domain || domain,
                asset_slug: aiJson.asset_type,
                service_type_slug: aiJson.service_type,
                issue_tags: aiJson.issue_tags || []
            })
            .eq('id', requestId);

        if (updateError) {
            console.error("Database update error:", updateError);
            return jsonResponse({ error: "database_error", message: "Failed to persist analysis" }, 500);
        }

        return jsonResponse({
            analysis: aiJson,
            idempotent: false,
            source: usedSource,
            degraded: isDegraded
        }, 200);

    } catch (error: any) {
        console.error("Handler error in analyze-request:", error);
        return jsonResponse({
            error: "internal_error",
            message: error?.message || 'Unexpected server error'
        }, 500);
    }
});
