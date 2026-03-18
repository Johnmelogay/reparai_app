import { QuestionSet } from "@/types";

export const QUESTION_SETS: Record<string, QuestionSet> = {
    hvac: {
        categoryId: 'hvac',
        questions: [
            { id: 'hvac_q1', text: 'O ar-condicionado liga?', type: 'boolean', required: true },
            {
                id: 'hvac_q2',
                text: 'Ele está gelando?',
                type: 'select',
                options: [
                    { label: 'Sim', value: 'yes' },
                    { label: 'Não', value: 'no' },
                    { label: 'Gelando pouco', value: 'little' }
                ],
                required: true
            },
            { id: 'hvac_q3', text: 'Está saindo água/vazando?', type: 'boolean', required: true },
            {
                id: 'hvac_q4',
                text: 'Tipo do aparelho',
                type: 'select',
                options: [
                    { label: 'Split', value: 'split' },
                    { label: 'Janela', value: 'window' },
                    { label: 'Portátil', value: 'portable' },
                    { label: 'K7 / Central', value: 'central' }
                ],
                required: true
            },
            {
                id: 'hvac_q5',
                text: 'Voltagem',
                type: 'select',
                options: [
                    { label: '110v', value: '110' },
                    { label: '220v', value: '220' },
                    { label: 'Não sei', value: 'unknown' }
                ],
                required: true
            },
        ]
    },
    electronics: {
        categoryId: 'electronics',
        questions: [
            { id: 'elec_q1', text: 'O aparelho liga?', type: 'boolean', required: true },
            { id: 'elec_q2', text: 'Teve contato com água?', type: 'boolean', required: true },
            { id: 'elec_q3', text: 'A tela está quebrada?', type: 'boolean', required: true },
            {
                id: 'elec_q4',
                text: 'Tempo de uso',
                type: 'select',
                options: [
                    { label: 'Menos de 1 ano', value: 'new' },
                    { label: '1 a 3 anos', value: 'mid' },
                    { label: 'Mais de 3 anos', value: 'old' }
                ],
                required: true
            },
            {
                id: 'elec_q5',
                text: 'Já foi aberto antes?',
                type: 'select',
                options: [
                    { label: 'Nunca', value: 'never' },
                    { label: 'Sim, reparo oficial', value: 'official' },
                    { label: 'Sim, reparo técnico', value: 'tech' }
                ],
                required: true
            },
        ]
    },
    appliances: {
        categoryId: 'appliances',
        questions: [
            { id: 'app_q1', text: 'O aparelho liga?', type: 'boolean', required: true },
            { id: 'app_q2', text: 'Está fazendo barulho estranho?', type: 'boolean', required: true },
            { id: 'app_q3', text: 'Está na garantia de fábrica?', type: 'boolean', required: true },
            {
                id: 'app_q4',
                text: 'Tipo do eletro',
                type: 'select',
                options: [
                    { label: 'Geladeira', value: 'fridge' },
                    { label: 'Máquina de Lavar', value: 'washer' },
                    { label: 'Fogão/Forno', value: 'stove' },
                    { label: 'Micro-ondas', value: 'microwave' }
                ],
                required: true
            },
            {
                id: 'app_q5',
                text: 'Marca',
                type: 'select',
                options: [
                    { label: 'Samsung / LG', value: 'premium' },
                    { label: 'Brastemp / Consul', value: 'standard' },
                    { label: 'Electrolux', value: 'electrolux' },
                    { label: 'Outra', value: 'other' }
                ],
                required: true
            },
        ]
    },
    agro: {
        categoryId: 'agro',
        questions: [
            { id: 'agro_q1', text: 'A máquina dá partida?', type: 'boolean', required: true },
            { id: 'agro_q2', text: 'Fumaça em excesso?', type: 'boolean', required: true },
            { id: 'agro_q3', text: 'Perda de potência?', type: 'boolean', required: true },
            {
                id: 'agro_q4',
                text: 'Tipo de combustível',
                type: 'select',
                options: [
                    { label: 'Gasolina Comum', value: 'gas' },
                    { label: 'Gasolina + Óleo 2T', value: 'mix' },
                    { label: 'Elétrica/Bateria', value: 'electric' },
                    { label: 'Diesel', value: 'diesel' }
                ],
                required: true
            },
            {
                id: 'agro_q5',
                text: 'Modelo/Marca',
                type: 'select',
                options: [
                    { label: 'STIHL', value: 'stihl' },
                    { label: 'Husqvarna', value: 'husqvarna' },
                    { label: 'Toyama', value: 'toyama' },
                    { label: 'Outra', value: 'other' }
                ],
                required: true
            },
        ]
    }
};
