const express = require("express");
const cors = require("cors");
const session = require("express-session");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "scottclub-whatsapp-secret",
    resave: false,
    saveUninitialized: false,
  })
);

let conectado = false;
let qrCodeAtual = null;

const USUARIO = "admin";
const SENHA = "bill1466";

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "scottclub-whatsapp",
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-software-rasterizer",
    ],
  },
});

function proteger(req, res, next) {
  if (req.session && req.session.logado) return next();
  return res.redirect("/login");
}

client.on("qr", (qr) => {
  conectado = false;
  qrCodeAtual = qr;
  console.log("Escaneie este QR Code com o WhatsApp:");
  qrcodeTerminal.generate(qr, { small: true });
});

client.on("ready", () => {
  conectado = true;
  qrCodeAtual = null;
  console.log("WhatsApp conectado com sucesso!");
});

client.on("authenticated", () => {
  console.log("WhatsApp autenticado.");
});

client.on("auth_failure", (msg) => {
  conectado = false;
  qrCodeAtual = null;
  console.log("Falha na autenticação:", msg);
});

client.on("disconnected", (reason) => {
  conectado = false;
  qrCodeAtual = null;
  console.log("WhatsApp desconectado:", reason);
});

client.initialize();

function htmlPage(content) {
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhatsApp API</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #0f172a, #111827);
        color: #fff;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        width: 92%;
        max-width: 420px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 22px;
        padding: 28px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        text-align: center;
      }
      input {
        width: 100%;
        padding: 14px;
        margin-bottom: 12px;
        border-radius: 12px;
        border: none;
        box-sizing: border-box;
      }
      button, .btn {
        display: inline-block;
        width: 100%;
        padding: 14px;
        border-radius: 12px;
        border: none;
        background: #22c55e;
        color: #052e16;
        font-weight: bold;
        cursor: pointer;
        text-decoration: none;
        box-sizing: border-box;
      }
      .btn-secondary {
        background: #334155;
        color: #fff;
        margin-top: 10px;
      }
      .status {
        padding: 10px 14px;
        border-radius: 999px;
        display: inline-block;
        margin: 12px 0;
        font-weight: bold;
      }
      .on { background: #dcfce7; color: #166534; }
      .off { background: #fee2e2; color: #991b1b; }
      img {
        width: 300px;
        height: 300px;
        background: #fff;
        padding: 12px;
        border-radius: 18px;
      }
      .erro {
        background: #fee2e2;
        color: #991b1b;
        padding: 10px;
        border-radius: 10px;
        margin-bottom: 12px;
      }
      p { color: #cbd5e1; }
    </style>
  </head>
  <body>
    ${content}
  </body>
  </html>`;
}

app.get("/login", (req, res) => {
  const erro = req.query.erro
    ? `<div class="erro">Usuário ou senha inválidos</div>`
    : "";

  res.send(
    htmlPage(`
      <div class="card">
        <h2>Login WhatsApp API</h2>
        <p>Acesse para conectar o WhatsApp</p>
        ${erro}
        <form method="POST" action="/login">
          <input name="usuario" placeholder="Usuário" />
          <input name="senha" placeholder="Senha" type="password" />
          <button type="submit">Entrar</button>
        </form>
      </div>
    `)
  );
});

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario === USUARIO && senha === SENHA) {
    req.session.logado = true;
    return res.redirect("/painel");
  }

  return res.redirect("/login?erro=1");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/", (req, res) => {
  res.redirect(req.session?.logado ? "/painel" : "/login");
});

app.get("/painel", proteger, async (req, res) => {
  let conteudoQr = "";

  if (!conectado && qrCodeAtual) {
    const qrImage = await QRCode.toDataURL(qrCodeAtual);
    conteudoQr = `
      <p>Escaneie o QR Code abaixo:</p>
      <img src="${qrImage}" />
    `;
  } else if (!conectado) {
    conteudoQr = `
      <p>WhatsApp desconectado.</p>
      <a class="btn" href="/painel">Conectar / atualizar QR Code</a>
    `;
  }

  res.send(
    htmlPage(`
      <div class="card">
        <h2>Painel WhatsApp</h2>
        <div class="status ${conectado ? "on" : "off"}">
          ${conectado ? "Conectado" : "Desconectado"}
        </div>
        ${conectado ? "<p>A API já pode enviar mensagens.</p>" : conteudoQr}
        <a class="btn btn-secondary" href="/logout">Sair</a>
      </div>
    `)
  );
});

app.get("/qrcode", proteger, (req, res) => {
  res.redirect("/painel");
});

function limparNumero(numero) {
  return String(numero).replace(/\D/g, "");
}

async function obterChatId(numero) {
  const numeroLimpo = limparNumero(numero);

  if (!numeroLimpo.startsWith("55")) {
    throw new Error("Use o número com código do Brasil. Exemplo: 5581999999999");
  }

  const numberId = await client.getNumberId(numeroLimpo);

  if (!numberId) {
    throw new Error("Número não encontrado no WhatsApp");
  }

  return {
    numeroLimpo,
    chatId: numberId._serialized,
  };
}

app.get("/status", (req, res) => {
  res.json({
    conectado,
    aguardando_qrcode: Boolean(qrCodeAtual),
  });
});

app.post("/enviar", async (req, res) => {
  try {
    const { numero, mensagem } = req.body;

    if (!numero || !mensagem) {
      return res.status(400).json({ erro: "Informe numero e mensagem" });
    }

    if (!conectado) {
      return res.status(400).json({
        erro: "WhatsApp ainda não conectado",
        painel: "/painel",
      });
    }

    const { numeroLimpo, chatId } = await obterChatId(numero);
    await client.sendMessage(chatId, mensagem);

    return res.json({ sucesso: true, numero: numeroLimpo, chatId, mensagem });
  } catch (error) {
    return res.status(500).json({
      erro: "Erro ao enviar mensagem",
      detalhe: error.message,
    });
  }
});

app.post("/enviar-cliente-quase-recompensa", async (req, res) => {
  try {
    const { numero, nome, pontosFaltando, recompensa, loja } = req.body;

    if (!numero || !nome || !pontosFaltando || !recompensa || !loja) {
      return res.status(400).json({
        erro: "Informe numero, nome, pontosFaltando, recompensa e loja",
      });
    }

    if (!conectado) {
      return res.status(400).json({
        erro: "WhatsApp ainda não conectado",
        qrcode: "/qrcode",
      });
    }

    const { numeroLimpo, chatId } = await obterChatId(numero);

    const mensagem = `Olá, ${nome}! 👋

Você está a apenas ${pontosFaltando} pontos de ganhar ${recompensa} na ${loja}.

Volte na loja e aproveite sua recompensa! 🎁`;

    await client.sendMessage(chatId, mensagem);

    return res.json({
      sucesso: true,
      numero: numeroLimpo,
      chatId,
      mensagem,
    });
  } catch (error) {
    console.error("Erro ao enviar recompensa:", error);

    return res.status(500).json({
      erro: "Erro ao enviar mensagem",
      detalhe: error.message,
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});