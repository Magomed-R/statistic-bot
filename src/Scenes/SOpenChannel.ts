import { Context, Markup, Scenes, deunionize } from "telegraf";
import StContext from "../Interfaces/StContext";
import User from "../Models/User";
import { Api } from "telegram";
import client from "../main";
import { message } from "telegraf/filters";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SOpenChannel = new Scenes.BaseScene<StContext>("openChannel");

SOpenChannel.enter(async (ctx) => {
    const user = await User.find(
        deunionize(ctx.callbackQuery)?.from.id.toString() || deunionize(ctx.message)!.from.id.toString()
    );
    const channel = user.channels?.find((el) => Number(el.id) === ctx.session.cid!);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    await ctx.reply(
        channel.title,
        Markup.keyboard([
            ["Самый популярный пост недели", "Самый непопулярный пост недели"],
            ["Топ 5 по репостам за неделю", "Топ 15 по репостам за месяц"],
            ["Топ 5 по просмотрам за неделю", "Топ 15 по просмотрам за месяц"],
            ["Топ 5 просмотр/репост за неделю", "Топ 15 просмотр/репост за месяц"],
            ["Топ 50 по репостам за пол года", "Топ 50 по репостам за всё время"],
            ["Топ 50 по просмотрам за пол года", "Топ 50 по просмотрам за всё время"],
            ["Топ 50 по просмотрам/репостам за пол года", "Топ 50 по просмотрам/репостам за всё время"],
            [
                channel.needNewsletter
                    ? "Выключить еженедельную статистику о канале"
                    : "Включить еженедельную статистику о канале",
            ],
            ["Удалить канал из списка"],
            ["🔙Назад"],
        ]).resize()
    );
});

SOpenChannel.hears("Топ 50 по репостам за пол года", async (ctx) => {
    const user_id = ctx.message.from.id;
    const user = await User.find(user_id!.toString());
    const channel = user.channels?.find((el) => el.id === ctx.session.cid);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    const result: any = await client.invoke(
        new Api.messages.GetHistory({
            peer: channel.url,
            limit: 100,
        })
    );

    for (let i = 1; i < 5; i++) {
        const cr: any = await client.invoke(
            new Api.messages.GetHistory({
                peer: channel.url,
                limit: 100,
                addOffset: i * 300,
            })
        );

        result.messages.push(...cr.messages);
    }
    console.log(result.messages.length);

    if (result.messages.length === 0) return await ctx.reply("В группе пока нет постов");

    for (let i = 0; i < 100; i++) {
        if (!result.messages[i]?.date) {
            result.messages.splice(i);
            break;
        }
        if (Number(result.messages[i].date + "000") < new Date().getTime() - 15778800000) {
            result.messages.splice(i);
            break;
        }
    }

    const messages = result.messages.sort((a: any, b: any) => b.forwards - a.forwards);
    const username = channel.private ? `c/${channel.id}` : result.chats[0].username;

    for (let i = 0; i < 50; i++) {
        await sendStat(ctx, username, messages[i]);
    }
});

SOpenChannel.hears("Топ 50 по просмотрам за пол года", async (ctx) => {
    const user_id = ctx.message.from.id;
    const user = await User.find(user_id!.toString());
    const channel = user.channels?.find((el) => el.id === ctx.session.cid);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    const result: any = await client.invoke(
        new Api.messages.GetHistory({
            peer: channel.url,
            limit: 100,
        })
    );

    for (let i = 1; i < 5; i++) {
        const cr: any = await client.invoke(
            new Api.messages.GetHistory({
                peer: channel.url,
                limit: 100,
                addOffset: i * 300,
            })
        );

        result.messages.push(...cr.messages);
    }

    if (result.messages.length === 0) return await ctx.reply("В группе пока нет постов");

    for (let i = 0; i < 100; i++) {
        if (!result.messages[i]?.date) {
            result.messages.splice(i);
            break;
        }
        if (Number(result.messages[i].date + "000") < new Date().getTime() - 15778800000) {
            result.messages.splice(i);
            break;
        }
    }

    const messages = result.messages.sort((a: any, b: any) => b.views - a.views);
    const username = channel.private ? `c/${channel.id}` : result.chats[0].username;

    for (let i = 0; i < 50; i++) {
        await sendStat(ctx, username, messages[i]);
    }
});

SOpenChannel.hears("Топ 50 по просмотрам/репостам за пол года", async (ctx) => {
    const user_id = ctx.message.from.id;
    const user = await User.find(user_id!.toString());
    const channel = user.channels?.find((el) => el.id === ctx.session.cid);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    const result: any = await client.invoke(
        new Api.messages.GetHistory({
            peer: channel.url,
            limit: 100,
        })
    );

    for (let i = 1; i < 5; i++) {
        const cr: any = await client.invoke(
            new Api.messages.GetHistory({
                peer: channel.url,
                limit: 100,
                addOffset: i * 300,
            })
        );

        result.messages.push(...cr.messages);
    }

    if (result.messages.length === 0) return await ctx.reply("В группе пока нет постов");

    for (let i = 0; i < 100; i++) {
        if (!result.messages[i]?.date) {
            result.messages.splice(i);
            break;
        }
        if (Number(result.messages[i].date + "000") < new Date().getTime() - 15778800000) {
            result.messages.splice(i);
            break;
        }
    }

    const messages = result.messages.sort((a: any, b: any) => b.views / b.forwards - a.views / a.forwards);
    const username = channel.private ? `c/${channel.id}` : result.chats[0].username;

    for (let i = 0; i < 50; i++) {
        await sendStat(ctx, username, messages[i]);
    }
});

SOpenChannel.hears("Топ 50 по репостам за всё время", async (ctx) => {
    const user_id = ctx.message.from.id;
    const user = await User.find(user_id!.toString());
    const channel = user.channels?.find((el) => el.id === ctx.session.cid);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    const result: any = await client.invoke(
        new Api.messages.GetHistory({
            peer: channel.url,
            limit: 100,
        })
    );

    for (let i = 1; i < 5; i++) {
        const cr: any = await client.invoke(
            new Api.messages.GetHistory({
                peer: channel.url,
                limit: 100,
                addOffset: i * 300,
            })
        );

        result.messages.push(...cr.messages);
    }

    if (result.messages.length === 0) return await ctx.reply("В группе пока нет постов");

    const messages = result.messages.sort((a: any, b: any) => b.forwards - a.forwards);
    const username = channel.private ? `c/${channel.id}` : result.chats[0].username;

    for (let i = 0; i < 50; i++) {
        await sendStat(ctx, username, messages[i]);
    }
});

SOpenChannel.hears("Топ 50 по просмотрам за всё время", async (ctx) => {
    const user_id = ctx.message.from.id;
    const user = await User.find(user_id!.toString());
    const channel = user.channels?.find((el) => el.id === ctx.session.cid);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    const result: any = await client.invoke(
        new Api.messages.GetHistory({
            peer: channel.url,
            limit: 100,
        })
    );

    for (let i = 1; i < 5; i++) {
        const cr: any = await client.invoke(
            new Api.messages.GetHistory({
                peer: channel.url,
                limit: 100,
                addOffset: i * 300,
            })
        );

        result.messages.push(...cr.messages);
    }

    if (result.messages.length === 0) return await ctx.reply("В группе пока нет постов");

    const messages = result.messages.sort((a: any, b: any) => b.views - a.views);
    const username = channel.private ? `c/${channel.id}` : result.chats[0].username;

    for (let i = 0; i < 50; i++) {
        await sendStat(ctx, username, messages[i]);
    }
});

SOpenChannel.hears("Топ 50 по просмотрам/репостам за всё время", async (ctx) => {
    const user_id = ctx.message.from.id;
    const user = await User.find(user_id!.toString());
    const channel = user.channels?.find((el) => el.id === ctx.session.cid);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    const result: any = await client.invoke(
        new Api.messages.GetHistory({
            peer: channel.url,
            limit: 100,
        })
    );

    for (let i = 1; i < 5; i++) {
        const cr: any = await client.invoke(
            new Api.messages.GetHistory({
                peer: channel.url,
                limit: 100,
                addOffset: i * 300,
            })
        );

        result.messages.push(...cr.messages);
    }

    if (result.messages.length === 0) return await ctx.reply("В группе пока нет постов");

    const messages = result.messages.sort((a: any, b: any) => b.views / b.forwards - a.views / a.forwards);
    const username = channel.private ? `c/${channel.id}` : result?.chats[0]?.username;

    for (let i = 0; i < 50; i++) {
        await sendStat(ctx, username, messages[i]);
    }
});

SOpenChannel.hears("Удалить канал из списка", async (ctx, next) => {
    const user = await User.find(ctx.message.from.id.toString());

    user.channels.splice(
        user.channels.findIndex((el: any) => el.id == ctx.session.cid),
        1
    );
    await User.save(user);

    await ctx.reply("✅Канал успешно удалён");
    await ctx.reply(
        "Сейчас добавлений каналов доступно: " +
            (user.unlimited ? "неограничено" : user.channelNum - user.channels.length)
    );

    await ctx.scene.leave();
});

SOpenChannel.use(async (ctx, next) => {
    const user_id = ctx.callbackQuery?.from.id || ctx.message?.from.id;
    const user = await User.find(user_id!.toString());
    const channel = user.channels?.find((el) => el.id === ctx.session.cid);

    if (!channel) return await ctx.reply("Внутренняя ошибка: канал не найден");

    const result: any = await client.invoke(
        new Api.messages.GetHistory({
            peer: channel.url,
            limit: 100,
        })
    );

    if (result.messages.length === 0) return await ctx.reply("В группе пока нет постов");

    console.log(result);

    ctx.state.user = user;
    ctx.state.channel = channel;
    ctx.state.messages = result.messages;
    ctx.state.result = result;

    return next();
});

SOpenChannel.hears("Самый популярный пост недели", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 604_800_000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    const best = ctx.state.messages.sort((a: any, b: any) => b.views - a.views)[0];
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    await ctx.reply(
        `Самое популярное сообщение: t.me/${username}/${best?.id} \n\n👁Просмотры: ${best?.views}\n🔁Репосты: ${
            best?.forwards
        }\n💖Реакции: ${getReactions(best?.reactions)}`,
        { link_preview_options: { is_disabled: true } }
    );
});

SOpenChannel.hears("Самый непопулярный пост недели", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 604_800_000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    const best = ctx.state.messages.sort((a: any, b: any) => a.views - b.views)[0];
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    await ctx.reply(
        `Самое не популярное сообщение: t.me/${username}/${best?.id} \n\n👁Просмотры: ${best?.views}\n🔁Репосты: ${
            best?.forwards
        }\n💖Реакции: ${getReactions(best?.reactions)}`,
        { link_preview_options: { is_disabled: true } }
    );
});

SOpenChannel.hears("Топ 5 по репостам за неделю", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 604_800_000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    ctx.state.messages = ctx.state.messages.sort((a: any, b: any) => b.forwards - a.forwards);
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    for (let k = 0; k < 5; k++) {
        await sendStat(ctx, username, ctx.state.messages[k]);
    }
});

SOpenChannel.hears("Топ 5 по просмотрам за неделю", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 604_800_000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    ctx.state.messages = ctx.state.messages.sort((a: any, b: any) => b.views - a.views);
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    for (let k = 0; k < 5; k++) {
        await sendStat(ctx, username, ctx.state.messages[k]);
    }
});

SOpenChannel.hears("Топ 5 просмотр/репост за неделю", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 604_800_000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    ctx.state.messages = ctx.state.messages.sort((a: any, b: any) => b.views / b.forwards - a.views / a.forwards);
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    for (let k = 0; k < 5; k++) {
        await sendStat(ctx, username, ctx.state.messages[k]);
    }
});

SOpenChannel.hears("Топ 15 по репостам за месяц", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 2592000000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    ctx.state.messages = ctx.state.messages.sort((a: any, b: any) => b.forwards - a.forwards);
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    for (let k = 0; k < 15; k++) {
        await sendStat(ctx, username, ctx.state.messages[k]);
    }
});

SOpenChannel.hears("Топ 15 по просмотрам за месяц", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 2592000000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    ctx.state.messages = ctx.state.messages.sort((a: any, b: any) => b.views - a.views);
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    for (let k = 0; k < 15; k++) {
        await sendStat(ctx, username, ctx.state.messages[k]);
    }
});

SOpenChannel.hears("Топ 15 просмотр/репост за месяц", async (ctx) => {
    for (let i = 0; i < 100; i++) {
        if (!ctx.state.messages[i]?.date) {
            ctx.state.messages.splice(i);
            break;
        }
        if (Number(ctx.state.messages[i]?.date + "000") < new Date().getTime() - 2592000000) {
            ctx.state.messages.splice(i);
            break;
        }
    }

    ctx.state.messages = ctx.state.messages.sort((a: any, b: any) => b.views / b.forwards - a.views / a.forwards);
    const username = ctx.state.channel.private ? `c/${ctx.state.channel.id}` : ctx.state.result.chats[0].username;

    for (let k = 0; k < 15; k++) {
        await sendStat(ctx, username, ctx.state.messages[k]);
    }
});

SOpenChannel.hears("Выключить еженедельную статистику о канале", async (ctx) => {
    ctx.state.user.channels[ctx.state.user.channels.findIndex((el: any) => el.id === ctx.session.cid)].needNewsletter =
        false;
    await User.save(ctx.state.user);
    await ctx.reply("✅Еженедельная статистика успешно выключена");
    return ctx.scene.enter("openChannel");
});

SOpenChannel.hears("Включить еженедельную статистику о канале", async (ctx) => {
    ctx.state.user.channels[ctx.state.user.channels.findIndex((el: any) => el.id === ctx.session.cid)].needNewsletter =
        true;
    await User.save(ctx.state.user);
    await ctx.reply("✅Еженедельная статистика успешно включена");
    return ctx.scene.enter("openChannel");
});

SOpenChannel.on(message("text"), async (ctx, next) => {
    await ctx.scene.leave();
    return next();
});

async function sendStat(ctx: Context, username: string, msg: any) {
    await ctx.reply(
        `t.me/${username}/${msg?.id} \n\n👁Просмотры: ${msg?.views}\n🔁Репосты: ${
            msg?.forwards
        }\n💖Реакции: ${getReactions(msg?.reactions)}`,
        { link_preview_options: { is_disabled: true } }
    );
}

function getReactions(reactions: any) {
    let count = 0;

    if (!reactions?.results) return "-";

    for (let i = 0; i < reactions.results.length; i++) {
        count += reactions.results[i].count;
    }

    return count;
}

export default SOpenChannel;
