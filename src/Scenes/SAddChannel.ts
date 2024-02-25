import { Markup, Scenes, deunionize } from "telegraf";
import StContext from "../Interfaces/StContext";
import User from "../Models/User";
import { Api } from "telegram";
import client from "../main";
import { message } from "telegraf/filters";
import IChannel from "../Interfaces/IChannel";

const SAddChannel = new Scenes.BaseScene<StContext>("addChannel");

SAddChannel.enter(async (ctx) => {
    const id = ctx.message?.from.id || ctx.callbackQuery?.from.id
    const user = await User.find(id!.toString())
    await ctx.reply(
        "Введите ссылку на канал. Ссылка на канал должна начинаться на https://t.me/, https://t.me/+ или https://t.me/joinchat/\n\nДоступных добавлений осталось: "+(user.unlimited ? 'неограничено' : user.channelNum-user.channels.length),
        Markup.inlineKeyboard([
            {
                text: "Отмена",
                callback_data: "cancel",
            },
        ])
    );
});

SAddChannel.hears(/^https:\/\/t.me\/joinchat\//, async (ctx, next) => {
    try {
        try {
            await client.invoke(
                new Api.messages.ImportChatInvite({
                    hash: ctx.message.text.slice(22),
                })
            );
        } catch (error) {
            console.log(error)
            if (error === "RPCError: 400: INVITE_HASH_EXPIRED (caused by messages.ImportChatInvite)") {
                return await ctx.reply("Ссылка на канал просрочена");
            }
            if (error === "RPCError: 400: INVITE_REQUEST_SENT (caused by messages.ImportChatInvite)") {
                return await ctx.reply("Заявка на добавление канала отправлена. Подождите немного, пока админы одобрят и повторите попытку");
            }
        }

        const user = await User.find(ctx.message.from.id.toString());

        const channel: IChannel | any = await client.invoke(
            new Api.channels.GetChannels({
                id: [ctx.message.text],
            })
        );

        if (user.channels?.find((el) => el.id === channel.chats[0].id.toJSNumber())) {
            await ctx.reply("Вы уже добавили этот канал ранее");
            return await ctx.scene.leave();
        }

        user.channels?.push({
            url: ctx.message.text,
            id: channel.chats[0].id.toJSNumber(),
            needNewsletter: false,
            title: channel.chats[0].title,
            private: true
        });

        await User.save(user);

        await ctx.reply("Успешно добавлен канал!");
        return ctx.scene.leave();
    } catch (error) {
        console.log(error);
        return await ctx.reply("Канал не найден. Попробуйте другую ссылку");
    }
});

SAddChannel.hears(/^https:\/\/t.me\/\+/, async (ctx, next) => {
    try {
        try {
            await client.invoke(
                new Api.messages.ImportChatInvite({
                    hash: ctx.message.text.slice(14),
                })
            );
        } catch (error: {code: number, errorMessage: string} | any) {
            console.log(error)
            if (error.errorMessage === "INVITE_HASH_EXPIRED") {
                return await ctx.reply("Ссылка на канал просрочена");
            }
            if (error.errorMessage === "INVITE_REQUEST_SENT") {
                return await ctx.reply("Заявка на добавление канала отправлена. Подождите немного, пока админы одобрят и повторите попытку");
            }
        }

        const user = await User.find(ctx.message.from.id.toString());

        const channel: IChannel | any = await client.invoke(
            new Api.channels.GetChannels({
                id: ['https://t.me/joinchat/'+ctx.message.text.slice(14)],
            })
        );

        if (user.channels?.find((el) => el.id === channel.chats[0].id.toJSNumber())) {
            await ctx.reply("Вы уже добавили этот канал ранее");
            return await ctx.scene.leave();
        }

        user.channels?.push({
            url: 'https://t.me/joinchat/'+ctx.message.text.slice(14),
            id: channel.chats[0].id.toJSNumber(),
            needNewsletter: false,
            title: channel.chats[0].title,
            private: true
        });

        await User.save(user);

        await ctx.reply("Успешно добавлен канал!");
        return ctx.scene.leave();
    } catch (error) {
        console.log(error)
        return await ctx.reply("Канала не существует или вы уже добавляли этот канал ранее");
    }
});

SAddChannel.hears(/^https:\/\/t.me\//, async (ctx, next) => {
    if (ctx.message.text.slice(0, 13) !== "https://t.me/") {
        return await ctx.reply("Ссылка на канал должна начинаться на https://t.me/");
    }

    try {
        await client.invoke(
            new Api.channels.JoinChannel({
                channel: ctx.message.text,
            })
        );

        const user = await User.find(ctx.message.from.id.toString());

        const channel: IChannel | any = await client.invoke(
            new Api.channels.GetChannels({
                id: [ctx.message.text],
            })
        );

        if (user.channels?.find((el) => el.id === channel.chats[0].id.toJSNumber())) {
            await ctx.reply("Вы уже добавили этот канал ранее");
            return await ctx.scene.leave();
        }

        user.channels?.push({
            url: ctx.message.text,
            id: channel.chats[0].id.toJSNumber(),
            needNewsletter: false,
            title: channel.chats[0].title,
            private: false
        });

        await User.save(user);

        await ctx.reply("Успешно добавлен канал!");
        return ctx.scene.leave();
    } catch (error) {
        console.log(error);
        return await ctx.reply("Канала не существует или вы уже добавляли этот канал ранее");
    }
});

SAddChannel.on(message("text"), async (ctx, next) => {
    if (ctx.message.text === "💲Оформить подписку" || ctx.message.text === "💬Мои каналы" || ctx.message.text === "➕Добавить канал" || ctx.message.text === "/start") {
        await ctx.scene.leave()
        return next()
    }
    await ctx.reply("Ссылка на канал должна начинаться на https://t.me/, https://t.me/+ или https://t.me/joinchat/");
});

SAddChannel.action("cancel", async (ctx) => {
    await ctx.reply("Добавление канала отменено");
    return ctx.scene.leave();
});

export default SAddChannel;
