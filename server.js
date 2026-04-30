const express = require("express");
const cors = require("cors");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();

app.use(cors());
app.use(express.json());

let conectado = false;
let qrCodeAtual = null;

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

app.get("/", (req, res) => {
  res.json({
    status: "API WhatsApp rodando",
    conectado,
    qrcode: qrCodeAtual ? "/qrcode" : null,
  });
});

app.get("/status", (req, res) => {
  res.json({
    conectado,
    aguardando_qrcode: Boolean(qrCodeAtual),
  });
});

app.get("/qrcode", async (req, res) => {
  try {
    if (conectado) {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 40px;">
            <h2>WhatsApp já está conectado ✅</h2>
            <p>A API já pode enviar mensagens.</p>
          </body>
        </html>
      `);
    }

    if (!qrCodeAtual) {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 40px;">
            <h2>QR Code ainda não gerado</h2>
            <p>Aguarde alguns segundos e atualize esta página.</p>
          </body>
        </html>
      `);
    }

    const qrImage = await QRCode.toDataURL(qrCodeAtual);

    return res.send(`
      <html>
        <head>
          <meta http-equiv="refresh" content="20">
          <title>QR Code WhatsApp</title>
        </head>
        <body style="font-family: Arial; text-align: center; padding: 40px;">
          <h2>Escaneie o QR Code</h2>
          <p>Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho</p>
          <img src="${qrImage}" style="width: 320px; height: 320px;" />
          <p>Esta página atualiza automaticamente.</p>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).json({
      erro: "Erro ao gerar QR Code",
      detalhe: error.message,
    });
  }
});

app.post("/enviar", async (req, res) => {
  try {
    const { numero, mensagem } = req.body;

    if (!numero || !mensagem) {
      return res.status(400).json({
        erro: "Informe numero e mensagem",
      });
    }

    if (!conectado) {
      return res.status(400).json({
        erro: "WhatsApp ainda não conectado",
        qrcode: "/qrcode",
      });
    }

    const { numeroLimpo, chatId } = await obterChatId(numero);

    await client.sendMessage(chatId, mensagem);

    return res.json({
      sucesso: true,
      numero: numeroLimpo,
      chatId,
      mensagem,
    });
  } catch (error) {
    console.error("Erro ao enviar:", error);

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