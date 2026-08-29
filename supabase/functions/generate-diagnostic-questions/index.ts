// supabase/functions/generate-diagnostic-questions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface DiagnosticQuestion {
    id: string;
    text: string;
    type: 'boolean' | 'select' | 'tri';
    options?: { label: string; value: string }[];
}

interface QuestionsResult {
    questions: DiagnosticQuestion[];
    confidence: number;
    source: "gemini" | "deterministic_fallback";
    degraded: boolean;
}

function getDeterministicFallback(category: string, answers: Record<string, string> = {}, userText?: string): QuestionsResult {
    const domain = (category || 'mobilidade').toLowerCase();
    const answeredKeys = Object.keys(answers || {});
    const count = answeredKeys.length;

    let questions: DiagnosticQuestion[] = [];
    let confidence = 0.35;

    if (domain.includes('mobilidade') || domain.includes('car') || domain.includes('moto') || domain.includes('bike')) {
        if (count === 0) {
            questions = [{
                id: 'q_mob_asset',
                text: 'Qual é o seu veículo?',
                type: 'select',
                options: [
                    { label: '🚗 Carro', value: 'carro' },
                    { label: '🏍️ Moto', value: 'moto' },
                    { label: '🚲 Bicicleta', value: 'bicicleta' },
                    { label: '🛴 Patinete', value: 'patinete' },
                ]
            }];
            confidence = 0.35;
        } else if (count === 1) {
            questions = [{
                id: 'q_mob_service',
                text: 'Qual a principal área do problema?',
                type: 'select',
                options: [
                    { label: '⚙️ Mecânica / Motor', value: 'mecanica' },
                    { label: '⚡ Elétrica / Bateria', value: 'eletrica' },
                    { label: '🛑 Freios e Suspensão', value: 'freios' },
                    { label: '❄️ Ar Condicionado', value: 'ar_condicionado' },
                ]
            }];
            confidence = 0.65;
        } else {
            questions = [{
                id: 'q_mob_symptom',
                text: 'O que está acontecendo no momento?',
                type: 'select',
                options: [
                    { label: '❌ Não liga / Parou de vez', value: 'nao_liga' },
                    { label: '🔊 Barulho anormal / Estalo', value: 'barulho' },
                    { label: '⚠️ Luz de alerta no painel', value: 'alerta_painel' },
                    { label: '💧 Vazamento aparente', value: 'vazamento' },
                ]
            }];
            confidence = 0.85;
        }
    } else if (domain.includes('casa') || domain.includes('home') || domain.includes('reforma')) {
        if (count === 0) {
            questions = [{
                id: 'q_casa_asset',
                text: 'Qual equipamento ou item precisa de reparo?',
                type: 'select',
                options: [
                    { label: '❄️ Ar Condicionado', value: 'ar_condicionado' },
                    { label: '🧊 Geladeira / Freezer', value: 'geladeira' },
                    { label: '💧 Encanamento / Pia / Vaso', value: 'hidraulica' },
                    { label: '⚡ Fiação / Disjuntor / Tomadas', value: 'eletrica' },
                    { label: '🧺 Máquina de Lavar', value: 'maquina_lavar' },
                ]
            }];
            confidence = 0.35;
        } else {
            questions = [{
                id: 'q_casa_symptom',
                text: 'Qual o defeito observado?',
                type: 'select',
                options: [
                    { label: '❌ Não liga ou parou', value: 'parou' },
                    { label: '💧 Vazamento de água', value: 'vazamento' },
                    { label: '🔊 Barulho excessivo / Vibração', value: 'barulho' },
                    { label: '⚡ Curto / Desarmando disjuntor', value: 'curto' },
                ]
            }];
            confidence = 0.85;
        }
    } else {
        // Tecnologia / Outros
        if (count === 0) {
            questions = [{
                id: 'q_tec_asset',
                text: 'Qual dispositivo precisa de conserto?',
                type: 'select',
                options: [
                    { label: '📱 Celular / Smartphone', value: 'celular' },
                    { label: '💻 Notebook / Computador', value: 'notebook' },
                    { label: '📺 Televisão / Smart TV', value: 'tv' },
                    { label: '🖨️ Impressora', value: 'impressora' },
                ]
            }];
            confidence = 0.35;
        } else {
            questions = [{
                id: 'q_tec_symptom',
                text: 'Qual o sintoma principal?',
                type: 'select',
                options: [
                    { label: '🖥️ Tela quebrada ou sem imagem', value: 'tela' },
                    { label: '🔋 Bateria não dura / Não carrega', value: 'bateria' },
                    { label: '❌ Não liga', value: 'nao_liga' },
                    { label: '🐢 Muito lento / Travando', value: 'lentidao' },
                ]
            }];
            confidence = 0.85;
        }
    }

    return {
        questions,
        confidence,
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
    // OPTIONS for CORS
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
        let body: any = {};
        try {
            body = await req.json();
        } catch {
            return jsonResponse({ error: "bad_request", message: "Invalid JSON payload" }, 400);
        }

        const { category = 'mobilidade', answers = {}, userText = '', min_confidence = 0.7 } = body || {};
        const domain = category;

        const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");

        // If no Gemini key is set in environment, seamlessly return deterministic high-confidence questions
        if (!apiKey) {
            const fallbackResult = getDeterministicFallback(domain, answers, userText);
            return jsonResponse(fallbackResult, 200);
        }

        // Construct Prompt for Gemini
        const systemPrompt = `Você é um assistente técnico especialista em triagem para o DOMÍNIO "${domain}".
SEU OBJETIVO: Fazer perguntas PROGRESSIVAS para identificar:
1. asset_type (equipamento/objeto exato)
2. service_type (mecânica, elétrica, hidráulica, manutenção, etc)
3. issue_tags (tags específicas do problema)

REGRAS:
- Gere APENAS 1 pergunta por vez.
- Se for pergunta de escolha, use type="select" com options (label com emoji e value).
- Se for confirmação sim/não, use type="boolean".
- Retorne estritamente JSON.`;

        const userPrompt = `Contexto:
- Categoria: ${category}
- Respostas atuais: ${JSON.stringify(answers)}
- Descrição do usuário: "${userText || ''}"

Retorne JSON no formato:
{
  "questions": [
    {
      "id": "q_" + sufixo_unico,
      "text": "Pergunta clara",
      "type": "select",
      "options": [{"label": "🚗 Carro", "value": "carro"}]
    }
  ],
  "confidence": 0.5 a 1.0
}`;

        try {
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
                    if (Array.isArray(parsed?.questions)) {
                        return jsonResponse({
                            questions: parsed.questions,
                            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
                            source: "gemini",
                            degraded: false
                        }, 200);
                    }
                }
            }
        } catch (geminiErr) {
            console.warn("⚠️ [generate-diagnostic-questions] Upstream Gemini failed, falling back gracefully:", geminiErr);
        }

        // Graceful Fallback if Gemini fails or times out
        const fallback = getDeterministicFallback(domain, answers, userText);
        return jsonResponse(fallback, 200);

    } catch (error: any) {
        console.error("Handler error:", error);
        return jsonResponse({
            error: "internal_error",
            message: error?.message || 'Unexpected error'
        }, 500);
    }
});
