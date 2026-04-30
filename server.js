const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();

app.use(cors());
app.use(express.json());

let conectado = false;

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
  console.log("Escaneie este QR Code com o WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  conectado = true;
  console.log("WhatsApp conectado com sucesso!");
});

client.on("authenticated", () => {
  console.log("WhatsApp autenticado.");
});

client.on("auth_failure", (msg) => {
  conectado = false;
  console.log("Falha na autenticação:", msg);
});

client.on("disconnected", (reason) => {
  conectado = false;
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
  });
});

app.get("/status", (req, res) => {
  res.json({
    conectado,
  });
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