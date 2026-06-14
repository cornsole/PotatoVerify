const { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const config = require('./data.json');

const db = new sqlite3.Database('./auth.db');
db.run("CREATE TABLE IF NOT EXISTS users (discord_id TEXT PRIMARY KEY, uuid TEXT, name TEXT, auth_date TEXT)");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

const commands = [
    new SlashCommandBuilder().setName('whois').setDescription('유저 정보 조회').addStringOption(option => option.setName('query').setDescription('닉네임 또는 ID').setRequired(true)),
    new SlashCommandBuilder().setName('unauth').setDescription('인증 해제').addUserOption(option => option.setName('target').setDescription('대상 유저').setRequired(true)),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

client.once(Events.ClientReady, async (c) => {
    try {
        await rest.put(Routes.applicationGuildCommands(c.user.id, config.guildId), { body: commands });
        console.log(`[✔] ${c.user.tag} 시작 & 명령어 등록 완료!`);
        client.user.setActivity('potato24.kr', { type: 4 });
    } catch (error) {
        console.error("명령어 등록 실패:", error);
    }
});

client.on(Events.GuildMemberAdd, async (member) => {
    const role = member.guild.roles.cache.get(config.unverifiedRoleId);
    if (role) await member.roles.add(role).catch(console.error);
});

client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    
    // 관리자 권한 체크
    if (!i.member.roles.cache.has(config.adminRoleId)) {
        return i.reply({ content: "권한 부족", flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === 'whois') {
        let q = i.options.getString('query').trim();
        
        const mentionMatch = q.match(/^<@!?(\d+)>$/);
        if (mentionMatch) q = mentionMatch[1];

        // 대소문자 구분 없이 검색 (COLLATE NOCASE)
        db.get("SELECT * FROM users WHERE name = ? COLLATE NOCASE OR discord_id = ?", [q, q], (err, row) => {
            if (err) return i.reply("조회 중 오류 발생");
            i.reply(row ? `닉네임: ${row.name}\nUUID: ${row.uuid}\nID: ${row.discord_id}` : "기록 없음");
        });
    } else if (i.commandName === 'unauth') {
        const target = i.options.getMember('target');
        db.run("DELETE FROM users WHERE discord_id = ?", [target.id]);
        await target.roles.remove(config.verifiedRoleId).catch(console.error);
        await target.roles.add(config.unverifiedRoleId).catch(console.error);
        
        // 기존 username 그대로 사용
        i.reply(`${target.user.username}님의 인증이 해제되었습니다.`);
    }
});

client.on(Events.MessageCreate, async (m) => {
    if (m.author.bot || !config.authChannelIds.includes(m.channel.id) || m.member.roles.cache.has(config.verifiedRoleId)) return;
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(m.content)) return;

    try {
        const res = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${m.content.trim()}`);
        db.run("INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?)", [m.author.id, res.data.id, res.data.name, new Date().toISOString()]);
        
        await m.member.roles.add(config.verifiedRoleId);
        await m.member.roles.remove(config.unverifiedRoleId);
        
        m.reply(`인증완료 (UUID: ${res.data.id})`);
    } catch (e) {
        m.reply(`닉네임 오류!`);
    }
});

client.login(config.token);