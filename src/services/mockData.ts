import { Category, LedgerEntry, Provider, Ticket } from '@/types';

/**
 * ============================================
 * DADOS MOCKADOS (SIMULADOS) DO APLICATIVO
 * ============================================
 * 
 * Este arquivo contém dados de exemplo que simulam informações reais.
 * Em produção, esses dados viriam de uma API/banco de dados.
 * 
 * VOCÊ PODE ALTERAR:
 * - Adicionar/remover categorias
 * - Adicionar/remover profissionais
 * - Mudar preços, avaliações, endereços
 * - Alterar imagens (URLs ou caminhos locais)
 */

/**
 * CATEGORIAS DE SERVIÇO
 * 
 * Define as categorias de serviços disponíveis no app.
 * Cada categoria tem:
 * - id: identificador único (usado internamente, não aparece para o usuário)
 * - name: nome que aparece na tela
 * - icon: imagem do ícone (pode ser: require('caminho/local') ou URL)
 * - description: texto explicativo curto
 * - tracks: tipos de serviço que essa categoria suporta
 *   - 'instant': Reparo rápido (chegada em até 1h)
 *   - 'evaluation': Precisa avaliar (diagnóstico em campo)
 *   - 'workshop': Levar para oficina (48h / agendado)
 * 
 * PARA ADICIONAR UMA NOVA CATEGORIA:
 * 1. Adicione um novo objeto aqui
 * 2. Adicione a imagem do ícone na pasta assets/images/
 * 3. Use require('../../assets/images/nome_do_arquivo.png')
 */
export const CATEGORIES: Category[] = [
    {
        // ID único - use apenas letras, números e underscore
        // Não use espaços ou caracteres especiais
        id: 'electronics',

        // Nome que aparece na tela para o usuário
        name: 'Eletrônicos',

        // Ícone: caminho para imagem na pasta assets/images/
        // Para usar imagem local: require('../../assets/images/nome.png')
        // Para usar URL: 'https://exemplo.com/imagem.png'
        icon: require('../../assets/images/electric_plug.png'),

        // Descrição curta que aparece abaixo do nome
        description: 'Celulares, computadores e dispositivos',

        // Tipos de serviço que essa categoria oferece:
        // 'instant' = Reparo rápido (até 1h)
        // 'evaluation' = Precisa avaliar primeiro
        // 'workshop' = Levar para oficina
        tracks: ['instant', 'evaluation', 'workshop']
    },
    {
        id: 'appliances',
        name: 'Eletrodomésticos',
        icon: require('../../assets/images/snowflake.png'),
        description: 'Linha branca e cozinha',
        // CORREÇÃO: estava 'ienstant' (erro de digitação), corrigido para 'instant'
        tracks: ['instant', 'evaluation', 'workshop']
    },
    {
        id: 'electrical',
        name: 'Elétrica Residencial',
        icon: require('../../assets/images/electric_plug.png'),
        description: 'Instalações e reparos elétricos',
        // Esta categoria não oferece serviço de oficina (workshop)
        tracks: ['instant', 'evaluation']
    },
    {
        id: 'agro',
        name: 'Agro/Jardinagem',
        icon: require('../../assets/images/plant.png'),
        description: 'Ferramentas e máquinas (STIHL e similares)',
        tracks: ['instant', 'evaluation', 'workshop']
    },
];

/**
 * PROFISSIONAIS PRÓXIMOS (PROVIDERS)
 * 
 * Lista de profissionais disponíveis na plataforma.
 * Cada profissional tem informações completas para exibição.
 * 
 * PROPRIEDADES IMPORTANTES:
 * - id: identificador único (string)
 * - name: nome do profissional/empresa
 * - category: categoria principal (texto que aparece)
 * - categories: array de IDs de categorias que ele atende (deve corresponder aos IDs em CATEGORIES)
 * - rating: nota de 0 a 5 (ex: 4.8)
 * - reviews: número de avaliações recebidas
 * - status: 'online' (disponível agora) ou 'offline' (indisponível)
 * - badges: selos de qualidade ['verified', 'professional', 'featured']
 * - coordinates: latitude e longitude (para mostrar no mapa)
 * - image: URL da foto ou caminho local
 * - visitPrice: preço da visita técnica (formato: '80,00' ou 'R$ 80,00')
 * 
 * PARA ADICIONAR UM NOVO PROFISSIONAL:
 * 1. Copie um objeto existente
 * 2. Altere os valores
 * 3. Use coordenadas reais se quiser aparecer no mapa
 * 4. Para imagem, use URL do Unsplash ou adicione na pasta assets/
 */
export const NEARBY_PROVIDERS: Provider[] = [
    {
        // ID único do profissional
        id: '1',

        // Nome que aparece na tela
        name: 'Agromotores',

        // Categoria principal (texto livre, pode ser diferente do ID)
        category: 'Agro/Jardinagem',

        // IDs das categorias que ele atende (devem existir em CATEGORIES)
        // Exemplo: ['agro', 'electronics'] = atende ambas
        categories: ['agro'],

        // Avaliação média (0.0 a 5.0)
        rating: 4.8,

        // Número total de avaliações
        reviews: 124,

        // Endereço físico da empresa
        address: 'R. Alm. Barroso, 1528',

        // Distância do usuário (calculada ou fixa)
        // Formato: '5,6 km' ou '250 m'
        distance: '5,6 km',

        // Status atual: 'online' (disponível) ou 'offline' (indisponível)
        status: 'online',

        // Selos de qualidade:
        // 'verified' = verificado pela plataforma
        // 'professional' = profissional certificado
        // 'featured' = destaque/premium
        badges: ['verified', 'professional', 'featured'],

        // Coordenadas GPS (latitude, longitude)
        // Porto Velho, RO: latitude ~-8.76, longitude ~-63.90
        // Use Google Maps para encontrar coordenadas exatas
        coordinates: { latitude: -8.7619, longitude: -63.9039 },

        // URL da imagem (pode ser Unsplash, Imgur, ou servidor próprio)
        // Ou use require() para imagem local
        image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',

        // Preço da visita técnica (formato brasileiro)
        visitPrice: '80,00',

        // Pontuação operacional (0-100) - usado para ranking
        operationalScore: 95,

        // Tempo médio de resposta em minutos
        responseTime: 12,

        // Taxa de resposta em % (0-100)
        responseRate: 98,

        // Taxa de conclusão em % (0-100)
        completionRate: 96,

        // Taxa de cancelamento em % (0-100)
        cancellationRate: 2,

        // Se é membro premium (aparece com destaque)
        isPremium: true,
    },
    {
        id: '2',
        name: 'HRB Refrigeração',
        category: 'Eletrodomésticos',
        categories: ['appliances'],
        rating: 4.5,
        reviews: 42,
        address: 'Av. Jatuarana, 2100',
        distance: '1,9 km',
        status: 'online',
        badges: ['verified', 'professional'],
        coordinates: { latitude: -8.7659, longitude: -63.8999 },
        image: 'https://images.unsplash.com/photo-1581094794329-cd1361ddee26?auto=format&fit=crop&w=800&q=80',
        visitPrice: '60,00',
        operationalScore: 88,
        responseTime: 25,
        responseRate: 92,
        completionRate: 94,
        cancellationRate: 4,
    },
    {
        id: '3',
        name: 'TechFix Eletrônicos',
        category: 'Eletrônicos',
        categories: ['electronics'],
        rating: 5.0,
        reviews: 10,
        address: 'Centro, Porto Velho',
        distance: '250 m',
        status: 'online',
        badges: ['verified', 'professional', 'featured'],
        coordinates: { latitude: -8.7609, longitude: -63.9019 },
        image: 'https://images.unsplash.com/photo-1504384308090-c54be3855485?auto=format&fit=crop&w=800&q=80',
        visitPrice: '100,00',
        operationalScore: 98,
        responseTime: 8,
        responseRate: 100,
        completionRate: 98,
        cancellationRate: 1,
        isPremium: true,
    },
    {
        id: '4',
        name: 'EletroMax',
        category: 'Elétrica Residencial',
        categories: ['electrical'],
        rating: 4.2,
        reviews: 89,
        address: 'R. Sete de Setembro, 800',
        distance: '3,2 km',
        status: 'offline',
        badges: ['verified'],
        coordinates: { latitude: -8.7679, longitude: -63.9059 },
        image: 'https://images.unsplash.com/photo-1621905251189-08b95d50c79f?auto=format&fit=crop&w=800&q=80',
        visitPrice: '90,00',
        operationalScore: 82,
        responseTime: 35,
        responseRate: 85,
        completionRate: 90,
        cancellationRate: 6,
    },
    {
        id: '5',
        name: 'Oficina do Zé',
        category: 'Agro/Jardinagem',
        categories: ['agro'],
        rating: 4.9,
        reviews: 210,
        address: 'Av. Nações Unidas, 1200',
        distance: '1,2 km',
        status: 'online',
        badges: ['verified', 'professional'],
        coordinates: { latitude: -8.7750, longitude: -63.8950 },
        image: 'https://images.unsplash.com/photo-1487180144351-b8472da7d4f1?auto=format&fit=crop&w=800&q=80',
        visitPrice: '50,00',
        operationalScore: 90,
        responseTime: 15,
        responseRate: 95,
        completionRate: 98,
        cancellationRate: 1,
    },
    {
        id: '6',
        name: 'Casa das Peças',
        category: 'Eletrônicos',
        categories: ['electronics'],
        rating: 4.0,
        reviews: 15,
        address: 'R. Dom Pedro II, 500',
        distance: '4,5 km',
        status: 'online',
        badges: ['verified'],
        coordinates: { latitude: -8.7600, longitude: -63.9100 },
        image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=80',
        visitPrice: '40,00',
        operationalScore: 85,
        responseTime: 40,
        responseRate: 90,
        completionRate: 92,
        cancellationRate: 3,
    },
    {
        id: '7',
        name: 'Jardinagem Verde',
        category: 'Agro/Jardinagem',
        categories: ['agro'],
        rating: 4.7,
        reviews: 55,
        address: 'Av. Calama, 3000',
        distance: '2,8 km',
        status: 'online',
        badges: ['verified'],
        coordinates: { latitude: -8.7700, longitude: -63.8900 },
        image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=800&q=80',
        visitPrice: '70,00',
        operationalScore: 89,
        responseTime: 20,
        responseRate: 93,
        completionRate: 95,
        cancellationRate: 2,
    },
    {
        id: '8',
        name: 'Refrigeração Polar',
        category: 'Eletrodomésticos',
        categories: ['appliances'],
        rating: 4.6,
        reviews: 78,
        address: 'R. Duque de Caxias, 900',
        distance: '3,0 km',
        status: 'online',
        badges: ['verified', 'professional'],
        coordinates: { latitude: -8.7630, longitude: -63.9080 },
        image: 'https://images.unsplash.com/photo-1632922267756-9b71242b1592?auto=format&fit=crop&w=800&q=80',
        visitPrice: '65,00',
        operationalScore: 87,
        responseTime: 30,
        responseRate: 91,
        completionRate: 93,
        cancellationRate: 3,
    },
];

/**
 * PEDIDOS/SOLICITAÇÕES MOCKADAS
 * 
 * Representa pedidos de serviço já criados.
 * Usado para exibir histórico e pedidos em andamento.
 * 
 * STATUS POSSÍVEIS:
 * - 'NEW': Novo pedido, buscando profissional
 * - 'OFFERED': Recebeu propostas de profissionais
 * - 'ACCEPTED': Aceitou uma proposta, aguardando pagamento
 * - 'PAID': Pagamento confirmado
 * - 'EN_ROUTE': Profissional a caminho
 * - 'DONE': Serviço concluído
 * - 'CANCELED': Pedido cancelado
 * 
 * TRACKS (Tipos de serviço):
 * - 'instant': Reparo rápido
 * - 'evaluation': Precisa avaliar
 * - 'workshop': Levar para oficina
 */
export const MOCK_TICKETS: Ticket[] = [
    {
        id: 'ticket_101',
        userId: 'user_1',
        category: 'agro',
        track: 'instant',
        description: 'Motosserra não liga, precisa de manutenção urgente',
        status: 'EN_ROUTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerId: '1',
        providerName: 'Agromotores',
        ticketFee: 15.00,
        ticketFeePaid: true,
        servicePrice: 150.00,
        estimatedArrival: 15,
        address: 'Av. Carlos Gomes, 123 - Centro',
        coordinates: { latitude: -8.76183, longitude: -63.90177 },
    },
    {
        id: 'ticket_102',
        userId: 'user_1',
        category: 'appliances',
        track: 'evaluation',
        description: 'Ar condicionado não está gelando, precisa de diagnóstico',
        status: 'DONE',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        providerId: '2',
        providerName: 'HRB Refrigeração',
        servicePrice: 200.00,
        completedAt: new Date(Date.now() - 86400000).toISOString(),
        address: 'Av. Carlos Gomes, 123 - Centro',
        warranty: {
            id: 'warranty_102',
            ticketId: 'ticket_102',
            providerId: '2',
            service: 'Limpeza de Ar Condicionado',
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            totalDays: 90,
            activatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
    },
];

/**
 * HISTÓRICO DE SERVIÇOS (LEDGER)
 * 
 * Registro histórico de todos os serviços realizados.
 * Usado na tela de histórico do usuário.
 * 
 * Cada entrada representa um serviço concluído ou cancelado.
 * Inclui informações de garantia quando aplicável.
 */
export const MOCK_LEDGER: LedgerEntry[] = [
    {
        id: 'ledger_102',
        ticketId: 'ticket_102',
        providerId: '2',
        providerName: 'HRB Refrigeração',
        service: 'Limpeza de Ar Condicionado',
        category: 'appliances',
        date: new Date(Date.now() - 86400000).toISOString(),
        price: 200.00,
        warranty: {
            id: 'warranty_102',
            ticketId: 'ticket_102',
            providerId: '2',
            service: 'Limpeza de Ar Condicionado',
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            totalDays: 90,
            activatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        status: 'completed',
    },
];

/**
 * FORMATO LEGADO (ANTIGO)
 * 
 * Formato antigo de pedidos, mantido para compatibilidade.
 * Pode ser removido quando não for mais necessário.
 * 
 * NOTA: Este formato está sendo substituído por MOCK_TICKETS
 */
export const REQUESTS = [
    {
        id: '101',
        providerName: 'Agromotores',
        service: 'Manutenção de Motosserra',
        date: 'Hoje, 14:30',
        status: 'In Progress',
        price: 'R$ 150,00',
        image: 'https://lh5.googleusercontent.com/p/AF1QipNbb2qgTqZ4G_jwQfR3p4Z8yE6wv5x_t-G4v3Zz=w408-h306-k-no',
    },
    {
        id: '102',
        providerName: 'HRB Refrigeração',
        service: 'Limpeza de Ar Condicionado',
        date: 'Ontem',
        status: 'Completed',
        price: 'R$ 200,00',
        image: 'https://images.unsplash.com/photo-1581094794329-cd1361ddee26?auto=format&fit=crop&w=800&q=80',
        warranty: {
            expiresAt: '2026-04-04',
            totalDays: 90,
        }
    },
];
