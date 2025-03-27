// server.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox'],
  },
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('QR Code gerado. Escaneie com seu WhatsApp.');
});

client.on('ready', () => {
  console.log('🤖 Bot está pronto!');
});

client.on('message', async (message) => {
  const content = message.body.toLowerCase();

  if (content === 'oi' || content === 'olá') {
    await message.reply(
      `Olá! 👋 Bem-vindo à Clínica Odontológica!

        Digite uma opção:
        1️⃣ Agendar consulta
        2️⃣ Falar com atendente`
    );
  } else if (content === '1') {
    await message.reply('Para agendar uma consulta, envie seu nome completo e CPF.');
  } else if (content === '2') {
    await message.reply('Um atendente entrará em contato com você em breve.');
  }
});

client.initialize();

app.get('/', (req, res) => {
  res.send('Bot da Clínica está rodando 🦷');
});

app.listen(port, () => {
  console.log(`Servidor Express rodando na porta ${port}`);
});
