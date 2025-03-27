// server.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox'],
  },
});


const userStates = {}; // Armazena o estado dos usuários e o tempo de última atividade
const userLastActivity = {}; // Última atividade de cada usuário
const INACTIVITY_TIMEOUT = 4 * 60 * 1000; // 2 minutos em milissegundos
const rateLimit = {}; // Armazena a contagem de mensagens por usuário
const RATE_LIMIT_WINDOW = 10 * 1000; // 10 segundos
const MAX_REQUESTS = 6; // Limite de 5 mensagens a cada 10 segundos

const isRateLimited = (sender) => {
    const now = Date.now();

    if (!rateLimit[sender]) {
        rateLimit[sender] = { count: 1, startTime: now };
        return false;
    }

    const timeDiff = now - rateLimit[sender].startTime;

    if (timeDiff > RATE_LIMIT_WINDOW) {
        // Se passou do tempo limite, reseta o contador
        rateLimit[sender] = { count: 1, startTime: now };
        return false;
    }

    rateLimit[sender].count += 1;

    if (rateLimit[sender].count > MAX_REQUESTS) {
        return true; // Bloqueia novas requisições
    }

    return false;
};

const sanitizeInput = (input) => {
  const forbiddenWords = [
      "DELETE", "DROP", "UPDATE", "FROM", "WHERE", "SELECT", "JOIN", 
      "CREATE", "ALTER", "INSERT", "EXEC", "MERGE", "TRUNCATE", "CALL",
      "GRANT", "REVOKE", "UNION", "INTERSECT", "EXCEPT"
  ];

  let sanitizedInput = input.toUpperCase(); // Converte para maiúsculas para comparação segura

  // Remove palavras proibidas
  forbiddenWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi"); // Regex para pegar palavras isoladas
      sanitizedInput = sanitizedInput.replace(regex, ""); // Remove a palavra
  });

  // Remove caracteres SQL suspeitos
  sanitizedInput = sanitizedInput.replace(/(--|;|\/\*|\*\/)/g, ""); 

  console.log("A entrada foi limpa\n");
  return sanitizedInput.trim(); // Retorna input seguro e sem espaços desnecessários
};

const sendMenu = async (sender) => {
  userStates[sender] = 'menu'; // Define o estado do usuário como "menu inicial"
  await client.sendMessage(
      sender,
      `🌿 *Bem-vindo ao Assistente Virtual da Equipe Pomar!* 🌿\n\n` +
      `👋 Olá! Eu sou seu assistente virtual. Como posso te ajudar hoje?\n\n` +
      `📌 Escolha uma das opções abaixo: \n\n` +
      `1️⃣ - Painel do Motorista 🚛\n` +
      `2️⃣ - Painel do Promotor 📢\n` +
      `3️⃣ - Painel do RH 🏢\n` +
      `4️⃣ - Painel do Financeiro 💰\n` +
      `5️⃣ - Falar com Suporte 🎧\n` +
      `8️⃣ - Enviar Currículo 📄\n` +
      `9️⃣ - Info ℹ️\n` +
      `0️⃣ - Sair 🚪\n\n` +
      `✍️ Digite o número da opção desejada.`
  );
};

let latestQR = '';

client.on('qr', (qr) => {
  latestQR = qr;
  console.log('QR Code atualizado. Acesse /qr para visualizar como imagem.');
});

// Rota para exibir o QR como imagem
app.get('/qr', async (req, res) => {
  if (!latestQR) return res.send('QR ainda não gerado');
  const qrImage = await QRCode.toDataURL(latestQR);
  res.send(`<img src="${qrImage}" style="width:300px;">`);
});

client.on('ready', () => {
  console.log('🤖 Bot está pronto!');
});

client.on('message', async (message) => {
  const sender = message.from;

  // Ignorar mensagens de grupos
  if (sender.includes('@g.us')) {
      return;
  }

  // Verifica se o usuário está enviando muitas requisições
  if (isRateLimited(sender)) {
    console.log(`Usuário ${sender} bloqueado temporariamente por excesso de requisições.`);
    await client.sendMessage(
        sender,
        `⚠️ *Você está enviando muitas mensagens rapidamente.*\n\n` +
        `⏳ Aguarde alguns segundos antes de continuar.`
    );
    return; // Impede a execução do código para evitar sobrecarga
  }
  // Verificar se o tempo de inatividade excedeu o limite
  if (userStates[sender] !== 'manual' && userLastActivity[sender] && Date.now() - userLastActivity[sender] > INACTIVITY_TIMEOUT) {
      console.log(`Conversa com ${sender} encerrada por inatividade.`);
      delete userStates[sender]; // Remove o estado
      delete userLastActivity[sender]; // Remove o rastreador de atividade
      await client.sendMessage(
          sender,
          `⌛ *Conversa Encerrada por Inatividade* ⌛\n\n` +
          `Parece que você ficou um tempo sem responder. 😕\n\n` +
          `🔄 *Para continuar, basta enviar qualquer mensagem e eu estarei pronto para te ajudar novamente!*`
      );
      return; // Impede processamento adicional da mensagem
  }

  // Atualiza o último tempo de atividade
  userLastActivity[sender] = Date.now();

  // Enviar o menu inicial se não houver estado
  if (!userStates[sender]) {
      //await sendMenu(sender);
      //return;
      userStates[sender] = 'termos'; // Define o estado inicial como "termos"
      await client.sendMessage(
          sender,
          `🌿 Olá! Eu sou o assistente virtual da *Distribuidora Pomar*! \n` +
          `Antes de prosseguirmos com o atendimento, precisamos que você aceite nosso *Termo de Consentimento*.\n\n` +
          `📜 *Termo de Consentimento - LGPD* 📜\n\n` +
          `Este termo visa registrar a manifestação livre, informada e inequívoca pela qual o usuário concorda com o tratamento de seus dados pessoais para finalidade específica, em conformidade com a Lei nº 13.709 - Lei Geral de Proteção de Dados Pessoais (LGPD).\n` +
          `Ao aceitar o presente termo, o usuário consente e concorda que a empresa *Distribuidora Pomar* tome decisões referentes ao tratamento de seus dados pessoais fornecidos, bem como realize o tratamento desses dados com a finalidade de consulta à nossa base de dados.\n\n` +
          `✅ Digite *1* - Caso esteja de acordo com os termos descritos acima e deseje continuar com o seu atendimento.\n` +
          `❌ Digite *2* - Caso queira finalizar o atendimento.`
      );
      return;
  }

  const userState = userStates[sender];

  if (userStates[sender] === 'termos') {
    await message.reply(
      `Olá! 👋 Bem-vindo à Clínica Odontológica!

        Digite uma opção:
        1️⃣ Agendar consulta
        2️⃣ Falar com atendente`
    );
  } else if (userStates[sender] === '1') {
    await message.reply('Para agendar uma consulta, envie seu nome completo e CPF.');
  } else if (userStates[sender] === '2') {
    await message.reply('Um atendente entrará em contato com você em breve.');
  }
});

// Lida com desconexões
client.on('disconnected', (reason) => {
  console.log('Bot desconectado:', reason);
});

client.initialize();

app.get('/', (req, res) => {
  res.send('Bot da Clínica está rodando 🦷');
});

app.listen(port, () => {
  console.log(`Servidor Express rodando na porta ${port}`);
});
