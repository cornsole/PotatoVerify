require('dotenv').config({ quiet: true });

const {
	Client,
	Events,
	GatewayIntentBits,
	ActivityType,
	REST,
	Routes,
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const adminRoleId = process.env.ADMIN_ROLE_ID;
const verifiedRoleId = process.env.VERIFIED_ROLE_ID;
const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID;
const logPath = path.join(__dirname, 'logs');
const configuredDatabasePath = process.env.DATABASE_PATH || 'user-data.sqlite';
const databasePath = path.isAbsolute(configuredDatabasePath)
	? configuredDatabasePath
	: path.join(__dirname, configuredDatabasePath);

for (const [name, value] of Object.entries({
	DISCORD_TOKEN: token,
	GUILD_ID: guildId,
	ADMIN_ROLE_ID: adminRoleId,
	VERIFIED_ROLE_ID: verifiedRoleId,
	UNVERIFIED_ROLE_ID: unverifiedRoleId,
})) {
	if (!value) throw new Error(`${name} 환경변수가 설정되지 않았습니다. .env.example을 참고하세요.`);
}

fs.mkdirSync(logPath, { recursive: true });
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
	PRAGMA journal_mode = WAL;
	CREATE TABLE IF NOT EXISTS users (
		mc_uuid TEXT PRIMARY KEY,
		discord_id TEXT NOT NULL UNIQUE,
		first_verified_at TEXT NOT NULL,
		last_verified_at TEXT NOT NULL
	);
`);

const findByUuid = database.prepare('SELECT * FROM users WHERE mc_uuid = ?');
const findByDiscordId = database.prepare('SELECT * FROM users WHERE discord_id = ?');
const insertUser = database.prepare(`
	INSERT INTO users (mc_uuid, discord_id, first_verified_at, last_verified_at)
	VALUES (?, ?, ?, ?)
`);
const deleteUser = database.prepare('DELETE FROM users WHERE mc_uuid = ? AND discord_id = ?');
function now() {
	return new Date().toISOString();
}

function displayDate(value) {
	return new Intl.DateTimeFormat('ko-KR', {
		timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium',
	}).format(new Date(value));
}

function log(message) {
	const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
	console.log(`${timestamp} - ${message}`);
	fs.appendFileSync(path.join(logPath, `${timestamp.slice(0, 10)}.log`), `\n${timestamp} - ${message}`);
}

function normalizeUuid(uuid) {
	return uuid.replaceAll('-', '').toLowerCase();
}

function isValidUuid(uuid) {
	return /^[0-9a-f]{32}$/i.test(normalizeUuid(uuid));
}

function isAdmin(interaction) {
	return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
		|| interaction.member?.roles?.cache?.has(adminRoleId);
}

function duplicateMessage(existing) {
	return `이미 인증된 계정입니다. <@&${adminRoleId}> 관리자에게 문의해 주세요. (최초 인증: ${displayDate(existing.first_verified_at)})`;
}

async function getMinecraftProfile(username) {
	const response = await axios.get(
		`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username.trim())}`,
		{ timeout: 10_000 },
	);
	return { uuid: normalizeUuid(response.data.id), name: response.data.name };
}

function addUser(uuid, discordId) {
	const existing = findByUuid.get(uuid) || findByDiscordId.get(discordId);
	if (existing) return { created: false, user: existing };

	const timestamp = now();
	insertUser.run(uuid, discordId, timestamp, timestamp);
	return { created: true, user: findByUuid.get(uuid) };
}

function migrateLegacyJson(legacyPath = path.join(__dirname, 'user-data.json')) {
	if (!fs.existsSync(legacyPath)) return;

	try {
		const rows = JSON.parse(fs.readFileSync(legacyPath, 'utf8')).users || [];
		let migrated = 0;
		for (const row of rows) {
			const rawUuid = row['minecraft-uuid'] || row.mc_uuid || row.uuid || '';
			const discordId = String(row['discord-acount'] || row.discord_id || '').trim();
			if (!isValidUuid(rawUuid) || !/^\d{17,20}$/.test(discordId)) continue;

			const uuid = normalizeUuid(rawUuid);
			if (findByUuid.get(uuid) || findByDiscordId.get(discordId)) continue;
			const parsedDate = new Date(row['verify-date'] || row.first_verified_at || '');
			const timestamp = Number.isNaN(parsedDate.getTime()) ? now() : parsedDate.toISOString();
			insertUser.run(uuid, discordId, timestamp, timestamp);
			migrated += 1;
		}
		if (migrated) log(`기존 JSON에서 ${migrated}명의 인증 정보를 이전했습니다.`);
	} catch (error) {
		log(`기존 user-data.json 마이그레이션 실패: ${error.message}`);
	}
}

migrateLegacyJson();

const commands = [
	new SlashCommandBuilder()
		.setName('인증')
		.setDescription('Minecraft 계정으로 서버 인증을 진행합니다.')
		.addStringOption(option => option.setName('닉네임').setDescription('Minecraft 닉네임').setRequired(true)),
	new SlashCommandBuilder()
		.setName('수동등록')
		.setDescription('관리자가 사용자의 Minecraft 계정을 수동 등록합니다.')
		.addUserOption(option => option.setName('사용자').setDescription('등록할 Discord 사용자').setRequired(true))
		.addStringOption(option => option.setName('닉네임').setDescription('Minecraft 닉네임').setRequired(true)),
	new SlashCommandBuilder()
		.setName('인증조회')
		.setDescription('관리자가 사용자의 인증 정보를 조회합니다.')
		.addUserOption(option => option.setName('사용자').setDescription('조회할 Discord 사용자'))
		.addStringOption(option => option.setName('uuid').setDescription('조회할 Minecraft UUID')),
	new SlashCommandBuilder()
		.setName('전송')
		.setDescription('관리자가 현재 채널에 봇 메시지를 전송합니다.')
		.addStringOption(option => option.setName('내용').setDescription('전송할 메시지').setRequired(true)),
].map(command => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, async readyClient => {
	try {
		const rest = new REST({ version: '10' }).setToken(token);
		await rest.put(Routes.applicationGuildCommands(readyClient.application.id, guildId), { body: commands });
		readyClient.user.setActivity('potato24.kr', { type: ActivityType.Competing });
		log(`[✔] ${readyClient.user.tag} 시작 및 슬래시 명령어 등록 완료`);
	} catch (error) {
		log(`슬래시 명령어 등록 실패: ${error.stack || error.message}`);
	}
});

client.on(Events.GuildMemberAdd, async member => {
	try {
		await member.roles.add(unverifiedRoleId);
		log(`[✔] ${member.user.tag}님에게 미인증 역할을 지급했습니다.`);
	} catch (error) {
		log(`${member.user.tag} 미인증 역할 지급 실패: ${error.message}`);
	}
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand() || interaction.guildId !== guildId) return;

	try {
		if (interaction.commandName === '인증') {
			await interaction.deferReply({ ephemeral: true });
			const existingDiscord = findByDiscordId.get(interaction.user.id);
			if (existingDiscord) return interaction.editReply(duplicateMessage(existingDiscord));

			const profile = await getMinecraftProfile(interaction.options.getString('닉네임', true));
			const existingUuid = findByUuid.get(profile.uuid);
			if (existingUuid) return interaction.editReply(duplicateMessage(existingUuid));

			addUser(profile.uuid, interaction.user.id);
			try {
				await interaction.member.roles.add(verifiedRoleId);
			} catch (error) {
				deleteUser.run(profile.uuid, interaction.user.id);
				throw error;
			}
			await interaction.member.roles.remove(unverifiedRoleId).catch(() => {});
			log(`${interaction.user.tag} 인증 완료: ${profile.name} (${profile.uuid})`);
			return interaction.editReply(`✅ 인증 완료: **${profile.name}**`);
		}

		if (!isAdmin(interaction)) {
			return interaction.reply({ content: '이 명령어는 관리자만 사용할 수 있습니다.', ephemeral: true });
		}

		if (interaction.commandName === '수동등록') {
			await interaction.deferReply({ ephemeral: true });
			const target = interaction.options.getUser('사용자', true);
			const profile = await getMinecraftProfile(interaction.options.getString('닉네임', true));
			const result = addUser(profile.uuid, target.id);
			if (!result.created) return interaction.editReply(duplicateMessage(result.user));

			const member = await interaction.guild.members.fetch(target.id).catch(() => null);
			if (member) {
				try {
					await member.roles.add(verifiedRoleId);
				} catch (error) {
					deleteUser.run(profile.uuid, target.id);
					throw error;
				}
				await member.roles.remove(unverifiedRoleId).catch(() => {});
			}
			log(`${interaction.user.tag}님이 ${target.tag} 수동 등록: ${profile.name} (${profile.uuid})`);
			return interaction.editReply(`✅ ${target}님을 **${profile.name}** 계정으로 등록했습니다.`);
		}

		if (interaction.commandName === '인증조회') {
			const target = interaction.options.getUser('사용자');
			const uuidInput = interaction.options.getString('uuid');
			if (!target && !uuidInput) {
				return interaction.reply({ content: '사용자 또는 UUID 중 하나를 입력해 주세요.', ephemeral: true });
			}
			const user = target
				? findByDiscordId.get(target.id)
				: (isValidUuid(uuidInput) ? findByUuid.get(normalizeUuid(uuidInput)) : null);
			if (!user) return interaction.reply({ content: '인증 정보를 찾을 수 없습니다.', ephemeral: true });
			return interaction.reply({
				content: `Discord: <@${user.discord_id}>\nMinecraft UUID: \`${user.mc_uuid}\`\n최초 인증: ${displayDate(user.first_verified_at)}\n마지막 인증: ${displayDate(user.last_verified_at)}`,
				ephemeral: true,
			});
		}

		if (interaction.commandName === '전송') {
			await interaction.channel.send(interaction.options.getString('내용', true));
			return interaction.reply({ content: '메시지를 전송했습니다.', ephemeral: true });
		}
	} catch (error) {
		const notFound = axios.isAxiosError(error) && error.response?.status === 404;
		const message = notFound
			? '올바른 Minecraft 닉네임을 입력해 주세요.'
			: '처리 중 오류가 발생했습니다. 관리자에게 문의해 주세요.';
		log(`${interaction.commandName} 처리 실패: ${error.stack || error.message}`);
		if (interaction.deferred || interaction.replied) await interaction.editReply(message).catch(() => {});
		else await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
	}
});

function shutdown() {
	client.destroy();
	database.close();
}

process.once('SIGINT', () => {
	shutdown();
	process.exit(0);
});

process.once('SIGTERM', () => {
	shutdown();
	process.exit(0);
});

if (require.main === module) {
	client.login(token).catch(error => {
		log(`Discord 로그인 실패: ${error.stack || error.message}`);
		shutdown();
		process.exitCode = 1;
	});
}

module.exports = {
	commands,
	normalizeUuid,
	isValidUuid,
	isAdmin,
	addUser,
	findByUuid,
	findByDiscordId,
	migrateLegacyJson,
	shutdown,
};
