const { config } = require("dotenv");
config();

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

const apiId = process.env.APP_ID;
const apiHash = process.env.APP_HASH;
const stringSession = new StringSession(""); // fill this later with the value from session.save()

(async () => {
    const client = new TelegramClient(stringSession, Number(apiId), apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text("Please enter your number: "),
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () => await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });
    console.log(client.session.save()); // Save this string to avoid logging in again
})()