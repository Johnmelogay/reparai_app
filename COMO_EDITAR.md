# 📝 Guia: Como Editar o Código do Reparaí

Este guia explica como editar o código do aplicativo, o que cada parte faz e onde fazer alterações.

## 📂 Estrutura de Arquivos

```
src/
├── app/                    # Telas do aplicativo
│   ├── (tabs)/            # Telas com abas (home, perfil, etc)
│   └── request/new/       # Fluxo de criar pedido
├── components/            # Componentes reutilizáveis
├── constants/             # Constantes (cores, espaçamentos)
├── context/               # Estado global (RequestContext)
├── services/              # Dados mockados e APIs
└── types/                 # Definições de tipos TypeScript
```

## 🎨 Alterando Cores

**Arquivo:** `src/constants/Colors.ts`

### Como alterar a cor primária (laranja):
```typescript
const harvestOrange = '#FD7B05';  // Mude este valor
```

### Onde encontrar cores:
- Use um color picker online: https://coolors.co
- Ou use códigos hex: `#FF0000` (vermelho), `#00FF00` (verde)

### Exemplo: Mudar cor primária para azul
```typescript
const harvestOrange = '#3B82F6';  // Azul
```

## 📱 Adicionando/Editando Categorias

**Arquivo:** `src/services/mockData.ts`

### Adicionar nova categoria:
```typescript
{
    id: 'nova_categoria',           // ID único (sem espaços)
    name: 'Nova Categoria',         // Nome que aparece na tela
    icon: require('../../assets/images/icone.png'),  // Imagem
    description: 'Descrição curta',
    tracks: ['instant', 'evaluation', 'workshop']  // Tipos de serviço
}
```

### Onde colocar a imagem:
1. Adicione a imagem em `assets/images/`
2. Use: `require('../../assets/images/nome_do_arquivo.png')`

## 👤 Adicionando/Editando Profissionais

**Arquivo:** `src/services/mockData.ts`

### Adicionar novo profissional:
```typescript
{
    id: '5',                        // ID único
    name: 'Nome do Profissional',
    category: 'Eletrônicos',
    categories: ['electronics'],     // IDs das categorias que atende
    rating: 4.5,                    // Nota (0 a 5)
    reviews: 50,                     // Número de avaliações
    address: 'Rua, Número - Bairro',
    distance: '2,5 km',
    status: 'online',                // 'online' ou 'offline'
    badges: ['verified'],            // Selos: 'verified', 'professional', 'featured'
    coordinates: { 
        latitude: -8.76183,          // Use Google Maps para encontrar
        longitude: -63.90177 
    },
    image: 'https://url-da-imagem.com/foto.jpg',
    visitPrice: '100,00',           // Preço da visita
    // ... outras propriedades
}
```

### Como encontrar coordenadas GPS:
1. Abra Google Maps
2. Clique com botão direito no local
3. Clique em "O que há aqui?"
4. Veja as coordenadas no formato: `-8.76183, -63.90177`

## 🏠 Adicionando/Editando Endereços

**Arquivo:** `src/context/RequestContext.tsx` (linha ~37)

### Adicionar novo endereço:
```typescript
{
    id: 'addr_3',
    label: 'Escritório',             // Rótulo (Casa, Trabalho, etc)
    address: 'Rua, Número - Bairro, Cidade - Estado',
    coordinates: { 
        latitude: -8.76183, 
        longitude: -63.90177 
    },
    isDefault: false,                // true = endereço padrão
}
```

## 📝 Alterando Textos das Telas

### Tela de Seleção de Categoria
**Arquivo:** `src/app/request/new/index.tsx`

```typescript
<Text style={styles.title}>Do que você precisa?</Text>
<Text style={styles.subtitle}>Escolha uma categoria para começar</Text>
```

### Tela de Localização
**Arquivo:** `src/app/request/new/location.tsx`

Procure por textos dentro de `<Text>` e altere diretamente.

## 🎯 Alterando Estilos (Cores, Tamanhos, Espaçamentos)

### Exemplo: Mudar tamanho do título
**Arquivo:** `src/app/request/new/index.tsx`

```typescript
title: {
    fontSize: 28,  // Mude para 32, 24, etc
    fontWeight: 'bold',
    color: Colors.light.text,
}
```

### Exemplo: Mudar cor de fundo
```typescript
container: {
    backgroundColor: Colors.light.background,  // Ou use cor direta: '#F5F5F5'
}
```

### Espaçamentos padronizados:
Use `Layout.spacing` em vez de números:
- `Layout.spacing.sm` = 8px
- `Layout.spacing.md` = 16px
- `Layout.spacing.lg` = 24px
- `Layout.spacing.xl` = 32px

## 🔄 Entendendo o Fluxo de Pedidos

1. **Home** → Usuário escolhe tipo de serviço
2. **Seleção de Categoria** → Escolhe categoria
3. **Seleção de Localização** → Escolhe endereço
4. **Detalhes** → Descreve o problema
5. **Seleção de Profissional** (ou Match direto) → Escolhe profissional
6. **Match** → Acompanha o pedido

### Onde está o estado:
**Arquivo:** `src/context/RequestContext.tsx`

Este arquivo gerencia todo o estado do pedido. Todas as telas acessam através de:
```typescript
const { status, category, startDraft } = useRequest();
```

## 🐛 Erros Comuns

### Erro: "Cannot find module"
- Verifique se o caminho do import está correto
- Use `@/` para importar de `src/`
- Exemplo: `import { Colors } from '@/constants/Colors';`

### Erro: "Type error"
- TypeScript está reclamando de tipos
- Verifique se os valores correspondem ao tipo esperado
- Exemplo: `status` deve ser uma string específica, não qualquer string

### App não atualiza
- Salve o arquivo (Cmd+S / Ctrl+S)
- O Expo deve recarregar automaticamente
- Se não, agite o dispositivo e escolha "Reload"

## 📚 Recursos Úteis

- **React Native Docs:** https://reactnative.dev/docs/getting-started
- **Expo Docs:** https://docs.expo.dev
- **Color Picker:** https://coolors.co
- **Google Maps (coordenadas):** https://www.google.com/maps

## 💡 Dicas

1. **Sempre teste após alterar:** Salve e veja o resultado
2. **Use comentários:** Já estão no código explicando cada parte
3. **Mantenha consistência:** Use `Colors` e `Layout` em vez de valores diretos
4. **Backup antes de grandes mudanças:** Faça commit no Git

## ❓ Precisa de Ajuda?

- Leia os comentários no código (estão em português)
- Cada arquivo tem comentários explicando o que faz
- Variáveis têm comentários explicando de onde vêm

---

**Lembre-se:** O código está todo comentado em português. Procure por comentários `//` ou `/* */` para entender melhor cada parte!

