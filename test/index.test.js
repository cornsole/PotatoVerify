const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');

process.env.DISCORD_TOKEN = 'test-token';
process.env.GUILD_ID = '123456789012345678';
process.env.ADMIN_ROLE_ID = '123456789012345679';
process.env.VERIFIED_ROLE_ID = '123456789012345680';
process.env.UNVERIFIED_ROLE_ID = '123456789012345681';
process.env.DATABASE_PATH = path.join(os.tmpdir(), `potatoverify-${process.pid}-${Date.now()}.sqlite`);

const {
	commands,
	normalizeUuid,
	isValidUuid,
	isAdmin,
	addUser,
	findByUuid,
	findByDiscordId,
	migrateLegacyJson,
	shutdown,
} = require('../index');

after(() => shutdown());

test('슬래시 명령어 정의가 Discord 형식으로 생성된다', () => {
	assert.deepEqual(commands.map(command => command.name), ['인증', '수동등록', '인증조회', '전송']);
	for (const command of commands) {
		assert.equal(command.type, 1);
		assert.ok(command.description.length > 0);
	}
});

test('UUID를 정규화하고 유효성을 검사한다', () => {
	assert.equal(
		normalizeUuid('01234567-89AB-CDEF-0123-456789ABCDEF'),
		'0123456789abcdef0123456789abcdef',
	);
	assert.equal(isValidUuid('01234567-89ab-cdef-0123-456789abcdef'), true);
	assert.equal(isValidUuid('not-a-uuid'), false);
});

test('Minecraft UUID와 Discord ID를 저장하고 조회한다', () => {
	const uuid = '0123456789abcdef0123456789abcdef';
	const discordId = '223456789012345678';
	const result = addUser(uuid, discordId);

	assert.equal(result.created, true);
	assert.equal(findByUuid.get(uuid).discord_id, discordId);
	assert.equal(findByDiscordId.get(discordId).mc_uuid, uuid);
	assert.equal(result.user.first_verified_at, result.user.last_verified_at);
});

test('동일 Minecraft UUID 또는 Discord ID의 중복 등록을 차단한다', () => {
	const existingUuid = '0123456789abcdef0123456789abcdef';
	const existingDiscordId = '223456789012345678';

	assert.equal(addUser(existingUuid, '323456789012345678').created, false);
	assert.equal(addUser('fedcba9876543210fedcba9876543210', existingDiscordId).created, false);
	assert.equal(findByUuid.get('fedcba9876543210fedcba9876543210'), undefined);
});

test('기존 JSON에서 유효한 행만 SQLite로 이전한다', () => {
	const legacyPath = path.join(os.tmpdir(), `potatoverify-legacy-${process.pid}-${Date.now()}.json`);
	fs.writeFileSync(legacyPath, JSON.stringify({
		users: [
			{
				'minecraft-uuid': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
				'discord-acount': '423456789012345678',
				'verify-date': '2025-01-02T03:04:05.000Z',
			},
			{ 'minecraft-uuid': 'invalid', 'discord-acount': 'not-a-discord-id' },
		],
	}));

	migrateLegacyJson(legacyPath);
	const migrated = findByUuid.get('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
	assert.equal(migrated.discord_id, '423456789012345678');
	assert.equal(migrated.first_verified_at, '2025-01-02T03:04:05.000Z');
	assert.equal(findByDiscordId.get('not-a-discord-id'), undefined);
});

test('관리자 권한 또는 관리자 역할로 권한을 판단한다', () => {
	const administrator = {
		memberPermissions: { has: () => true },
		member: { roles: { cache: { has: () => false } } },
	};
	const roleAdmin = {
		memberPermissions: { has: () => false },
		member: { roles: { cache: { has: id => id === process.env.ADMIN_ROLE_ID } } },
	};
	const normalUser = {
		memberPermissions: { has: () => false },
		member: { roles: { cache: { has: () => false } } },
	};

	assert.equal(isAdmin(administrator), true);
	assert.equal(isAdmin(roleAdmin), true);
	assert.equal(isAdmin(normalUser), false);
});
