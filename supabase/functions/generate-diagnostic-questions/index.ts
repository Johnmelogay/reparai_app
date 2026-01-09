// supabase/functions/generate-diagnostic-questions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    try {
        const { category, answers, userText, min_confidence = 0.7 } = await req.json();

        // category now contains domain slug (mobilidade, casa, tecnologia)
        const domain = category;

        // Use GEMINI_API_KEY
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) {
            throw new Error("Missing GEMINI_API_KEY");
        }

        // Construct Prompt - NOW DOMAIN-AWARE FOR 3D TAXONOMY
        const systemPrompt = `Você é um assistente técnico especialista em triagem para o DOMÍNIO "${domain}".
        
SEU OBJETIVO: Fazer perguntas PROGRESSIVAS para identificar:
1. **asset_type** (equipamento/objeto exato)
2. **service_type** (mecânica, elétrica, hidráulica, manutenção, etc)
3. **issue_tags** (tags específicas do problema)

**CONTEXTO DE DOMÍNIO:**
- Se "mobilidade": pergunte sobre carro, moto, bicicleta, patinete
- Se "casa": pergunte sobre ar_condicionado, geladeira, chuveiro, pia, vaso, portão, janela
- Se "tecnologia": pergunte sobre tv, celular, notebook, impressora

REGRAS RÍGIDAS E CRÍTICAS:
1. **MODO INICIAL (Cold Start)**: Se 'answers' estiver vazio:
   - GERE uma pergunta para identificar o aparelho/equipamento (ex: "Qual tipo de equipamento?")
   - GERE uma pergunta para identificar o problema macro (ex: "O que está acontecendo?")

2. **MODO "OUTRO" (Input Manual)**: 
   - O sistema força input de texto para "Outro".
   - Se resposta for texto (ex: "Bicicleta Caloi"), ACEITE como aparelho identificado.

3. **THRESHOLD DE CONFIANÇA (${min_confidence}):**
   - SÓ PARE de perguntar (retorne 'questions': []) SE:
     a) 'confidence' >= ${min_confidence}
     b) Você tem informação suficiente para determinar asset_type + service_type
   
   **INFORMAÇÕES MÍNIMAS POR DOMÍNIO:**
   - **mobilidade**: VEÍCULO (carro/moto/bicicleta) + PROBLEMA (mecânica/elétrica) + SINTOMA específico
   - **casa**: EQUIPAMENTO ou LOCAL + TIPO DE SERVIÇO (hidráulica/elétrica/manutenção) + SINTOMA
   - **tecnologia**: DISPOSITIVO + DEFEITO específico

4. **FORMATO E TIPOS (CRÍTICO)**:
   - **NUNCA** use 'type: "boolean"' para perguntas abertas.
   - Se pergunta for "Onde?", "Qual?", USE 'type: "select"' com opções.
   - Se pergunta for Sim/Não, use 'type: "boolean"'.
   - **EMOJIS**: Use SEMPRE emoji no início do 'label' (ex: "🚗 Carro", "❄️ Ar Condicionado").
   - Retorne APENAS JSON.

5. **COERÊNCIA LÓGICA E MEMÓRIA (CRÍTICO)**:
           - **RESPEITE O CONTEXTO**: Se o usuário disse que é uma "Bicicleta", **JAMAIS** pergunte sobre "Ar condicionado", "Motor", "Gasolina" ou coisas que não existem no objeto.
           - **NÃO SEJA REDUNDANTE**: Se o usuário escreveu "Patinete com problema na bateria":
             - NÃO pergunte "Qual o problema?" oferecendo "Bateria" como opção. VOCÊ JÁ SABE QUE É BATERIA.
             - Pergunte DETALHES: "A bateria não carrega ou descarrega rápido?", "Quanto tempo tem?", etc.
           - **AFUNILAMENTO INTELIGENTE**: Cada resposta deve restringir o universo das próximas perguntas.
           - **MEMÓRIA DE "OUTRO"**: Se o input foi manual (ex: "Drone"), assuma que é um Drone e pergunte sobre hélices, bateria, câmera.

        6. **QUANTIDADE**:
           - **GERE APENAS 1 (UMA) PERGUNTA POR VEZ.**
           - O fluxo deve ser: Pergunta IA -> Resposta User -> Pergunta IA. Não mande listas.

        7. **SAÍDA JSON**:
           - { "questions": [...], "confidence": 0.XX }`;

        const userPrompt = `Contexto do pedido de serviço:
- Categoria: ${category}
- Respostas Atuais (O que já sabemos): ${JSON.stringify(answers)}
- Descrição do usuário: "${userText || ''}"

Tarefa:
Gere as próximas perguntas.
Se for pergunta de "Onde", "Qual", "Como" -> USE type="select" com opções.
Se for pergunta de confirmação -> USE type="boolean".

Saída JSON Obrigatória:

Saída JSON Obrigatória:
{
    "questions": [
        {
            "id": "q_" + timestamp ou sequencial_unico (CRÍTICO: GERE UM ID ÚNICO CADA VEZ, ex: "q_bateria_1", "q_local_2"),
            "text": "Texto da pergunta",
            "type": "boolean" | "select",
            "options": [{"label": "🚗 Opção A", "value": "a"}] (OBRIGATÓRIO PARA SELECT)
        }
    ],
    "confidence": 0.1 a 1.0 (Se < 0.7, o sistema continuará perguntando)
}`;

        // Gemini 2.0 Flash Request
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

        // Extract Text from Gemini Response
        // Structure: candidates[0].content.parts[0].text
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            console.error("Gemini No Content:", data);
            throw new Error(`No content from Gemini. Full Response: ${JSON.stringify(data)}`);
        }

        let parsedContent;
        try {
            // Gemini might return Markdown code blocks sometimes even with JSON mode, handle just in case
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedContent = JSON.parse(cleanContent);
        } catch (e) {
            console.error("JSON Parse Error:", content);
            throw new Error("Failed to parse AI JSON response");
        }

        return new Response(JSON.stringify(parsedContent), {
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
