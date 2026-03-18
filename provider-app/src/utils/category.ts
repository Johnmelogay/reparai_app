const MOBILIDADE_ALIASES = new Set([
    'mobilidade',
    'auto',
    'mecanica',
    'mecânica',
    'vehicle',
    'veiculo',
    'veículo',
    'car',
]);

const TECNOLOGIA_ALIASES = new Set([
    'tecnologia',
    'technology',
    'tech',
    'electronics',
    'eletronicos',
    'eletrônicos',
    'informatica',
    'informática',
    'celular',
]);

const CASA_ALIASES = new Set([
    'casa',
    'home',
    'residencial',
    'hvac',
    'plumbing',
    'gardening',
    'cleaning',
    'beauty',
    'carpentry',
    'pest_control',
    'handyman',
    'electrical',
]);

export function normalizeCategoryDomain(value?: string | null): string | null {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    if (!normalized) return null;

    if (MOBILIDADE_ALIASES.has(normalized)) return 'mobilidade';
    if (CASA_ALIASES.has(normalized)) return 'casa';
    if (TECNOLOGIA_ALIASES.has(normalized)) return 'tecnologia';

    return normalized;
}

export function categoryLabel(value?: string | null): string {
    const domain = normalizeCategoryDomain(value);
    if (domain === 'mobilidade') return 'Mobilidade';
    if (domain === 'casa') return 'Casa';
    if (domain === 'tecnologia') return 'Tecnologia';
    return value || '—';
}

