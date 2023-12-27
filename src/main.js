const { config } = require("dotenv");
config();

const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");

const apiId = process.env.APP_ID;
const apiHash = process.env.APP_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING);

const bot = new Telegraf(process.env.BOT_TOKEN);
const client = new TelegramClient(stringSession, Number(apiId), apiHash);

(async () => {
    await client.connect();
})();

bot.telegram.setMyCommands([
    {
        command: "/menu",
        description: "Открыть меню",
    },
]);

bot.on(message("text"), async (ctx) => {
    const msg = ctx.update.message;
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    let database = getDatabase();

    if (!database.users[fromId]) {
        database.users[fromId] = {
            id: msg.from.id,
            state: "base",
            channels: [],
        };

        saveDatabase(database);
        database = getDatabase();
    }

    if (database.users[fromId].state === "adding channel") {
        if (database.users[fromId].channels.findIndex((el) => el.url === msg.text) !== -1) {
            bot.telegram.sendMessage(chatId, "Канал уже есть в списке. Добавьте другой канал", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Отмена",
                                callback_data: "cancelAddingChannel",
                            },
                        ],
                    ],
                },
            });

            return;
        }
        const newChannel = {
            url: msg.text,
            needNewsletter: false,
        };

        try {
            const result = await client.invoke(
                new Api.channels.GetFullChannel({
                    channel: msg.text,
                })
            );

            newChannel.id = result.chats[0].id;
            newChannel.title = result.chats[0].title;

            database.users[fromId].channels.push(newChannel);
            database.users[fromId].state = "base";

            saveDatabase(database);

            bot.telegram.sendMessage(chatId, "Успешно добавлен канал!");
        } catch (error) {
            console.log(error);

            bot.telegram.sendMessage(chatId, "Неправильная ссылка на канал! Попробуйте снова", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Отмена",
                                callback_data: "cancelAddingChannel",
                            },
                        ],
                    ],
                },
            });
        }

        return;
    }
    if (msg.text === "/start") {
        bot.telegram.sendMessage(
            chatId,
            "Добро пожаловать в бота для сбора статистики о каналах! \n\nЧтобы начать, откройте меню (/menu) и выберете 'Добавить канал' "
        );

        return;
    }
    if (msg.text === "/menu") {
        bot.telegram.sendMessage(chatId, "Меню", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Добавить канал",
                            callback_data: "addChannel",
                        },
                    ],
                    [
                        {
                            text: "Мои каналы",
                            callback_data: "myChannels",
                        },
                    ],
                ],
            },
        });

        return;
    }
});

bot.on("callback_query", async (ctx) => {
    const query = ctx.update.callback_query;
    const chatId = ctx.update.callback_query.message.chat.id;
    const fromId = query.from.id.toString();
    let database = getDatabase();

    if (!database.users[fromId]) {
        database.users[fromId] = {
            id: query.from.id,
            state: "base",
            channels: [],
        };

        saveDatabase(database);
        database = getDatabase();
    }

    let myChannels = { ...database }?.users[fromId]?.channels;

    if (query.data === "addChannel") {
        database.users[fromId].state = "adding channel";

        saveDatabase(database);

        bot.telegram.sendMessage(chatId, "Введите ссылку на канал. Например: https://t.me/steshathekot", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Отмена",
                            callback_data: "cancelAddingChannel",
                        },
                    ],
                ],
            },
        });
    }

    if (query.data === "myChannels") {
        bot.telegram.sendMessage(chatId, "Мои каналы", {
            reply_markup: {
                inline_keyboard: [...new Array(myChannels.length)].map((el, i) => {
                    return [{ text: myChannels[i].title, callback_data: `menuChannel ${myChannels[i].id}` }];
                }),
            },
        });
    }

    if (query.data.split(" ")[0] === "menuChannel") {
        const channelId = query.data.split(" ")[1];
        const channel = myChannels.find((el) => el.id === channelId);

        bot.telegram.sendMessage(chatId, channel.title, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Самый популярный пост недели",
                            callback_data: `getMostPopularPost ${channelId}`,
                        },
                    ],
                    [
                        {
                            text: "Самый непопулярный пост недели",
                            callback_data: `getMostNonPopularPost ${channelId}`,
                        },
                    ],
                    [
                        {
                            text: channel.needNewsletter
                                ? "Выключить еженедельную статистику о канале"
                                : "Включить еженедельную статистику о канале",
                            callback_data: `toggleNewsletter ${channelId}`,
                        },
                    ],
                    [
                        {
                            text: "Удалить канал из списка",
                            callback_data: `removeChannel ${channelId}`,
                        },
                    ],
                ],
            },
        });
    }

    if (query.data.split(" ")[0] === "getMostPopularPost" || query.data.split(" ")[0] === "getMostNonPopularPost") {
        const data = query.data.split(" ");
        const channelId = data[1];
        const sortMethod =
            data[0] === "getMostPopularPost"
                ? (a, b) => (b.views / b.forwards) * 10 - (a.views / a.forwards) * 10
                : (a, b) => (a.views / a.forwards) * 10 - (b.views / b.forwards) * 10;
        const ne = data[0] === "getMostPopularPost" ? "" : " не";

        try {
            const channelUrl = database.users[fromId].channels.find((el) => el.id === channelId).url;

            const result = await client.invoke(
                new Api.messages.GetHistory({
                    peer: channelUrl,
                })
            );

            let bestMessage = result.messages.sort(sortMethod)[0];

            bot.telegram.sendMessage(
                chatId,
                `Самое${ne} популярное сообщение: t.me/${result.chats[0].username}/${bestMessage.id} \n\nПросмотры: ${
                    bestMessage.views
                }\nРепосты: ${bestMessage.forwards}\nРеакции: ${getReactions(bestMessage.reactions)}`
            );
        } catch (error) {
            console.log(error);

            bot.telegram.sendMessage(chatId, "Внутренняя ошибка, попробуйте снова");
        }
    }

    if (query.data.split(" ")[0] === "removeChannel") {
        const channelId = query.data.split(" ")[1];
        const channels = database.users[fromId].channels;

        database.users[fromId].channels.splice(
            channels.findIndex((el) => el.id === channelId),
            1
        );

        saveDatabase(database);

        bot.telegram.deleteMessage(chatId, query.message.message_id);
        bot.telegram.sendMessage(chatId, "Канал успешно удалён из списка!");
    }

    if (query.data === "cancelAddingChannel") {
        database.users[fromId].state = "base";

        saveDatabase(database);

        bot.telegram.deleteMessage(chatId, query.message.message_id);
        bot.telegram.sendMessage(chatId, "Добавление канала отменено");
    }

    if (query.data.split(" ")[0] === "toggleNewsletter") {
        try {
            const channelId = query.data.split(" ")[1].toString();
            const channelIndex = database.users[fromId].channels.findIndex((el) => el.id === channelId);
            let needNewsletter = database.users[fromId].channels[channelIndex].needNewsletter;

            if (!needNewsletter) {
                database.users[fromId].channels[channelIndex].needNewsletter = false;
                needNewsletter = database.users[fromId].channels[channelIndex].needNewsletter;
            }

            database.users[fromId].channels[channelIndex].needNewsletter = !needNewsletter;

            saveDatabase(database);
            const reply_markup = query.message.reply_markup;

            reply_markup.inline_keyboard[2][0].text = needNewsletter
                ? "Включить еженедельную статистику о канале"
                : "Выключить еженедельную статистику о канале";

            bot.telegram.editMessageReplyMarkup(chatId, query.message.message_id, {}, reply_markup);
        } catch (error) {
            console.log(error);

            bot.telegram.sendMessage(chatId, "Произошла ошибка. Повторите попытку");
            bot.telegram.sendMessage(2128372313, "error: " + error);
        }
    }
});

bot.launch({ allowedUpdates: true });

setInterval(async () => {
    if (new Date().getDay() === 0) {
        const database = getDatabase();

        for (let i in database.users) {
            for (let j = 0; j < database.users[i].channels.length; j++) {
                if (database.users[i]?.channels[j]?.needNewsletter) {
                    try {
                        const result = await client.invoke(
                            new Api.messages.GetHistory({
                                peer: database.users[i]?.channels[j].url,
                            })
                        );

                        let bestMessage = result.messages.sort((a, b) => (b.views / b.forwards) * 10 - (a.views / a.forwards) * 10)[0];
                        let badestMessage = result.messages.sort((a, b) => (a.views / a.forwards) * 10 - (b.views / b.forwards) * 10)[0];

                        bot.telegram.sendMessage(
                            i,
                            `Самое популярное сообщение: t.me/${result.chats[0].username}/${bestMessage.id} \n\nПросмотры: ${
                                bestMessage.views
                            }\nРепосты: ${bestMessage.forwards}\nРеакции: ${getReactions(bestMessage.reactions)}`
                        );

                        bot.telegram.sendMessage(
                            i,
                            `Самое не популярное сообщение: t.me/${result.chats[0].username}/${badestMessage.id} \n\nПросмотры: ${
                                badestMessage.views
                            }\nРепосты: ${badestMessage.forwards}\nРеакции: ${getReactions(badestMessage.reactions)}`
                        );
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        }
    }
}, 86_400_000);

function getDatabase() {
    return JSON.parse(fs.readFileSync("./src/database/data.json", "utf-8"));
}

function saveDatabase(database) {
    if (!database) return;
    fs.writeFileSync("./src/database/data.json", JSON.stringify(database), "utf-8");
}

function getReactions(reactions) {
    let count = 0;

    if (!reactions?.results) return "-";

    for (let i = 0; i < reactions.results.length; i++) {
        count += reactions.results[i].count;
    }

    return count;
}
