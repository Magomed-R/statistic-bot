import { config } from "dotenv";
config();

import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Telegraf, Markup, deunionize, Scenes, Context, session } from "telegraf";
import { message } from "telegraf/filters";
import User from "./Models/User";
import StContext from "./Interfaces/StContext";
import SOpenChannel from "./Scenes/SOpenChannel";
import SAddChannel from "./Scenes/SAddChannel";
import cron from "node-cron"
import IUser from "./Interfaces/IUser";

const { APP_ID, APP_HASH, SESSION_STRING, BOT_TOKEN, PROVIDER_TOKEN } = process.env;

if (!SESSION_STRING) {
    throw new Error(
        "Необходимо заполнить поле SESSION_STRING в .env-файле данными, полученными после выполнения команды npm getSS"
    );
}

if (!BOT_TOKEN) {
    throw new Error("Необходимо заполнить поле BOT_TOKEN в .env-файле токеном, полученным от https://t.me/botFather");
}

const stringSession = new StringSession(SESSION_STRING!);

const client = new TelegramClient(stringSession, Number(APP_ID!), APP_HASH!, {});

(async () => {
    await client.connect();
})();

const bot = new Telegraf<StContext>(BOT_TOKEN);
const stage = new Scenes.Stage<StContext>([SOpenChannel, SAddChannel])

bot.on("pre_checkout_query", async (ctx) => {
    return await ctx.answerPreCheckoutQuery(true);
});

bot.on("successful_payment", async (ctx) => {
    const userId = ctx.message.successful_payment.invoice_payload.split("_")[0];
    const tarif = ctx.message.successful_payment.invoice_payload.split("_")[1];
    const user = await User.find(userId);

    if (tarif === 'unlimited') {
        user.unlimited = true
        user.subscription = true;
        await User.save(user);
    }
    if (tarif === 'oneAdd') {
        user.subscription = true;
        user.expiration = new Date().getTime() + 2592000000;
        user.channelNum++

        await User.save(user);
    }

    return await bot.telegram.sendMessage(userId, "Благодарим за приобретение подписки!");
});

bot.telegram.setMyCommands([
    {
        command: "/menu",
        description: "Открыть меню",
    },
]);

bot.action("agreeTerms", async (ctx, next) => {
    const id = ctx.callbackQuery.from.id.toString();
    const user = await User.find(id);

    user.agree_terms = true;
    await User.save(user);

    await bot.telegram.sendMessage(
        ctx.callbackQuery.from.id,
        "Меню",
        Markup.keyboard([
            [
                {
                    text: "➕Добавить канал",
                },
            ],
            [{ text: "💬Мои каналы" }],
            // [{ text: "💲Оформить подписку" }],
        ]).resize()
    );

    return next();
});

bot.command("support", ctx => ctx.reply("🧑‍💻Связаться с разработчиком: \n@a_temp_file"))

bot.command("terms", ctx => ctx.reply(
    "Правила использования:\n1. Продолжая использовать данного бота вы соглашаетесь на сбор данных об вашем аккаунте\n2. Отменить подписку можно в течении 10 дней после оформления, связавшись с разработчиком(/support)"
))

bot.use(session())

bot.use(stage.middleware())

bot.use(async (ctx, next) => {
    const user_id = deunionize(ctx.message)?.from.id.toString()! || deunionize(ctx.callbackQuery)?.from.id.toString()!;

    if (!user_id) return await ctx.reply("Отправляйте только текстовые сообщения и команды");

    let user = await User.find(user_id);

    if (!user) {
        await User.save({
            id: user_id,
            agree_terms: false,
            channels: [],
            expiration: new Date().getTime() + 2592000000,
            channelNum: 1,
            subscription: false,
            unlimited: true
        });

        user = await User.find(user_id);
    }

    if (!user.agree_terms) {
        return ctx.reply(
            "Чтобы продолжить, примите условия использования\nПрочесть условия использования: /terms",
            Markup.inlineKeyboard([[{ text: "Принять и продолжить", callback_data: `agreeTerms` }]])
        );
    }

    ctx.session = {}

    return next();
});

bot.hears("➕Добавить канал", async (ctx) => {
    const user_id = ctx.message.from.id.toString();
    const user = await User.find(user_id);

    if (user.channelNum <= user.channels.length && !user.unlimited) {
        await ctx.reply(
            "Больше не осталось добавлений каналов\nКупите добавление канала, или удалите один из каналов, или оформите безлимитную подписку и получите возможность получать статистику о любом телеграм канале навсегда!"
        );
        return await ctx.reply("Выберите тип подписки", Markup.inlineKeyboard([[{text: 'Одно добавление канала', callback_data: 'oneAddChannel'}], [{text: "Безлимитный тариф", callback_data: "unlimitedTarif"}]]))
    }

    return ctx.scene.enter("addChannel");
});

bot.hears("💬Мои каналы", async (ctx) => {
    const user_id = ctx.message.from.id.toString();
    const user = await User.find(user_id);

    return bot.telegram.sendMessage(user_id, "Мои каналы", {
        reply_markup: {
            inline_keyboard: [...new Array(user.channels!.length)].map((el, i) => {
                return [
                    {
                        text: user.channels![i].title,
                        callback_data: `openChannel ${user.channels![i].id}`,
                    },
                ];
            }),
        },
    });
});

bot.action(/^openChannel/, async (ctx) => {
    const user = await User.find(deunionize(ctx.callbackQuery)!.from.id.toString());

    ctx.session.cid = Number(deunionize(ctx.callbackQuery)!.data?.split(" ")[1]!);

    return ctx.scene.enter('openChannel')
});

bot.hears("💲Оформить подписку", async (ctx, next) => {
    await ctx.reply("Выберите тип подписки", Markup.inlineKeyboard([[{text: 'Одно добавление канала', callback_data: 'oneAddChannel'}], [{text: "Безлимитный тариф", callback_data: "unlimitedTarif"}]]))
});

bot.on(message("text"), async (ctx) => {
    await bot.telegram.sendMessage(
        ctx.message.from.id,
        "Меню",
        Markup.keyboard([
            [
                {
                    text: "➕Добавить канал",
                },
            ],
            [{ text: "💬Мои каналы" }],
            // [{ text: "💲Оформить подписку" }],
        ]).resize()
    );
});

bot.action('oneAddChannel', async ctx => {
    await invoiceForOneAdd(ctx.callbackQuery.from.id)
})

bot.action('unlimitedTarif', async ctx => {
    await invoiceForUnlimited(ctx.callbackQuery.from.id)
})

async function invoiceForOneAdd(chatId: string | number) {
    await bot.telegram.sendInvoice(chatId, {
        provider_token: PROVIDER_TOKEN!,
        title: "Оформление подписки для получения статистики о каналах",
        description:
            'Оплачивая подписку, вы получаете одно добавление канала на один месяц. Если есть вопросы - обращайтесь в поддрежку ( /support )',
        payload: `${chatId}_oneAdd`,
        currency: "RUB",
        prices: [{ amount: 400 * 100, label: "Руб" }],
        start_parameter: "test",
    });
}

async function invoiceForUnlimited(chatId: string | number) {
    await bot.telegram.sendInvoice(chatId, {
        provider_token: PROVIDER_TOKEN!,
        title: "Оформление безлимитной подписки для получения статистики о каналах",
        description:
            'Оплачивая подписку, вы получаете доступ ко всем функциям бота навсегда. Если есть вопросы - обращайтесь в поддрежку ( /support )',
        payload: `${chatId}_unlimited`,
        currency: "RUB",
        prices: [{ amount: 3000 * 100, label: "Руб" }],
        start_parameter: "test",
    });
}

bot.launch();

cron.schedule("0 10 * * Sun", async () => {
    const users = await User.all()
    
    for (let i in users) {
        if (users[i].channelNum > 0 || users[i].unlimited) {
            for (let j = 0; j < users[i].channels.length; j++) {
                if (users[i]?.channels[j]?.needNewsletter) {
                    try {
                        const result: any = await client.invoke(
                            new Api.messages.GetHistory({
                                peer: users[i]?.channels[j].url,
                                limit: 100,
                            })
                        );

                        for (let k = 0; k < 100; k++) {
                            if (Number(result.messages[k].date + "000") < new Date().getTime() - 604_800_000) {
                                result.messages.splice(k);
                                break;
                            }
                        }

                        let best = result.messages.sort(
                            (a: any, b: any) => b.views - a.views
                        )[0];
                        let badest = result.messages.sort(
                            (a: any, b: any) => a.views - b.views
                        )[0];
                        const username = users[i]?.channels[j].private ? `c/${users[i]?.channels[j].id}` : result.chats[0].username

                        await bot.telegram.sendMessage(users[i].id,
                            `Самое популярное сообщение: t.me/${username}/${best.id} \n\n👁Просмотры: ${
                                best.views
                            }\n🔁Репосты: ${best.forwards}\n💖Реакции: ${getReactions(best.reactions)}`,
                            { link_preview_options: { is_disabled: true } }
                        );

                        await bot.telegram.sendMessage(users[i].id,
                            `Самое непопулярное сообщение: t.me/${username}/${badest.id} \n\n👁Просмотры: ${
                                badest.views
                            }\n🔁Репосты: ${badest.forwards}\n💖Реакции: ${getReactions(badest.reactions)}`,
                            { link_preview_options: { is_disabled: true } }
                        );
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        }
    }
})

cron.schedule("0 0 * * *", async () => {
    const users: IUser[] = await User.all()

    for (const id in users) {
        if (users[id].channelNum > 0) {
            if (users[id].expiration! < new Date().getTime() || !users[id].unlimited) {
                const user = await User.find(id)

                user.expiration = new Date().getTime() + 2592000000
                user.channels.splice(0, user.channelNum)
                user.channelNum--;
                await User.save(user)
            }
        }
    }
})

function getReactions(reactions: any) {
    let count = 0;

    if (!reactions?.results) return "-";

    for (let i = 0; i < reactions.results.length; i++) {
        count += reactions.results[i].count;
    }

    return count;
}

export default client