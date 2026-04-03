# 🎙️ Rádio Atividade - Redesign

Um redesign moderno, responsivo e totalmente funcional da página da Rádio Atividade com suporte completo para dispositivos móveis e desktop.

## ✨ Principais Melhorias

### Design
- **Design Moderno**: Interface limpa e profissional com gradientes elegantes
- **Paleta de Cores**: Cores harmoniosas e bem definidas (azul primário, verde WhatsApp, amarelo clima)
- **Tipografia**: Fontes modernas e legíveis com hierarquia clara
- **Espaçamento**: Layout bem organizado com espaçamento consistente

### Responsividade
- **Desktop**: Layout em 3 colunas otimizado para telas grandes (1400px+)
- **Tablet**: Layout em 2 colunas para tablets (768px - 1024px)
- **Mobile**: Layout em 1 coluna totalmente adaptado para celulares (<768px)
- **Pequenos Celulares**: Otimizações especiais para telas muito pequenas (<480px)

### Funcionalidades
- **Player de Rádio**: Play/Pause com controle de volume
- **Disco Girando**: Animação do vinil que gira quando a rádio está tocando ✅
- **Tema Escuro**: Toggle entre tema claro e escuro com persistência
- **Carrossel**: Rotação automática de imagens promocionais
- **Notícias em Tempo Real**: Integração com RSS da G1
- **Clima**: Temperatura de Rio de Janeiro atualizada
- **Programação**: Grade de horários com destaque do programa atual
- **WhatsApp**: Botão de contato direto

## 📁 Estrutura de Arquivos

```
radio-atividade-novo/
├── index.html           # Arquivo HTML principal
├── css/
│   └── style.css       # Estilos CSS responsivos
├── js/
│   └── script.js       # Funcionalidades JavaScript
├── assets/
│   ├── base/
│   │   ├── logo.png
│   │   └── vinyl.png
│   └── uploads/        # Imagens de promoções e programação
└── README.md           # Este arquivo
```

## 🚀 Como Usar

### Opção 1: Abrir Localmente
1. Extraia os arquivos
2. Abra o arquivo `index.html` no navegador
3. Pronto! A página está funcionando

### Opção 2: Usar um Servidor Local
```bash
# Com Python 3
python3 -m http.server 8000

# Com Node.js
npx http-server

# Com PHP
php -S localhost:8000
```

Depois acesse: `http://localhost:8000`

## 🎨 Personalização

### Cores
Edite as variáveis CSS no início do arquivo `css/style.css`:

```css
:root {
  --primary-color: #305fbd;      /* Azul principal */
  --accent-color: #25d366;       /* Verde WhatsApp */
  /* ... outras cores ... */
}
```

### Rádio
Para mudar a URL da rádio, edite em `js/script.js`:

```javascript
<source src="https://stream.zeno.fm/zh7jkchfce4uv" type="audio/mpeg" />
```

### Programação
Edite o array `scheduleData` em `js/script.js` para adicionar/modificar programas.

### Imagens
Coloque novas imagens na pasta `assets/uploads/` e atualize as referências no HTML e JavaScript.

## 📱 Breakpoints Responsivos

- **Desktop**: 1024px+
- **Tablet**: 768px - 1024px
- **Mobile**: 480px - 768px
- **Small Mobile**: < 480px

## 🔧 Recursos Técnicos

- HTML5 semântico
- CSS3 com Grid e Flexbox
- JavaScript vanilla (sem dependências)
- APIs externas:
  - Zeno.fm (streaming de rádio)
  - RSS2JSON (notícias)
  - Open-Meteo (clima)

## 🌙 Tema Escuro

O tema escuro é salvo automaticamente no localStorage do navegador. O usuário pode alternar entre temas clicando no ícone no canto superior direito.

## 🎵 Animação do Vinil

O disco de vinil gira automaticamente quando:
- O botão de play é pressionado
- A rádio começa a tocar

E para quando:
- O botão de pausa é pressionado
- A rádio é pausada

## 📊 Performance

- Carregamento rápido (sem frameworks pesados)
- Otimizado para mobile
- Imagens otimizadas
- CSS minificável
- JavaScript eficiente

## 🐛 Troubleshooting

### A rádio não toca
- Verifique sua conexão de internet
- Verifique se a URL do stream está correta
- Tente recarregar a página

### Notícias não carregam
- Verifique sua conexão de internet
- A API do RSS2JSON pode estar indisponível

### Clima não atualiza
- Verifique sua conexão de internet
- A API do Open-Meteo pode estar indisponível

## 📄 Licença

Este projeto é fornecido como está para uso da Rádio Atividade.

---

**Desenvolvido com ❤️ para Rádio Atividade**
