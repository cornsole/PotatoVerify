require('dotenv').config({ quiet: true });

const { Client, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const axios = require('axios'); //api로 요청을 보내기위한 모듈
const fs = require('fs'); //로깅을 위한 모듈
const user_data = fs.readFileSync('./user-data.json', 'utf8');
const { error } = require('console');
const LogPath = './logs'

const token = process.env.DISCORD_TOKEN;

if (!token) {
	throw new Error('DISCORD_TOKEN 환경변수가 설정되지 않았습니다. .env.example을 참고해 .env 파일을 생성하세요.');
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
});

function dateFormat() {
	date = new Date()
	let month = date.getMonth() + 1;
	let day = date.getDate();
	let hour = date.getHours();
	let minute = date.getMinutes();
	let second = date.getSeconds();

	month = month >= 10 ? month : '0' + month;
	day = day >= 10 ? day : '0' + day;
	hour = hour >= 10 ? hour : '0' + hour;
	minute = minute >= 10 ? minute : '0' + minute;
	second = second >= 10 ? second : '0' + second;

	return date.getFullYear() + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second ;	
}
function dateNoTimeFormat() {
	date = new Date()
	let month = date.getMonth() + 1;
	let day = date.getDate();

	month = month >= 10 ? month : '0' + month;
	day = day >= 10 ? day : '0' + day;

	return date.getFullYear() + '-' + month + '-' + day;	
}
//echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"

function log(m){
	console.log(`${dateFormat()} - ${m}`)
	fs.appendFileSync(`${LogPath}/${dateNoTimeFormat()}.log`, `\n${dateFormat()} - ${m}`);
	//save as file
}


// 뭐든지  을 앞에 쓰면 날짜와 시간을 표시해줌


/*

추가 아이디어

유저에게도 인증이 완료되면 무언가 보이게 하기
기본적인 규칙이라던가 튜토리얼이라던가

*/

client.once(Events.ClientReady, readyClient => {
	//봇 시작 로그
	log(`[\x1b[32m✔\x1b[0m] ${readyClient.user.tag} is started!`);
    //봇 Activity setting (@@하는중)
	//client.user.setActivity('potato24.xyz', { type: ActivityType.Streaming });
	client.user.setActivity('potato24.kr', { type: ActivityType.Competing });
	//client.user.setActivity('potato24.xyz', { type: ActivityType.Listening });
	//client.user.setActivity('potato24.xyz', { type: ActivityType.Playing });
	//client.user.setActivity('potato24.xyz', { type: ActivityType.Watching });
	//client.user.setActivity('potato24.xyz 할까 생각중', { type: ActivityType.Custom});
});

// client.on('ready' , async() =>{
// 	console.log('시작딤')
//     const guild = client.guilds.cache.get('976793978630438922');
//     colors = ['fcba03'];
//     var role = guild.roles.cache.get('1376788317391290378')
//     setInterval(() => {
//         const roleCount = guild.roles.cache.get(role).members.size;
//         if(roleCount >= 1){
//         var random = Math.floor(Math.random() * colors.length);
//         role.edit({
//         color: colors[random]
//         })
//         console.log('Rainbow Color changed, it is now: ' + colors[random])
//         }
//         else{
//         console.log('No user with rainbow role')
//         }
                
//     }, 600*1000)
// });

// 메시지 전송
client.on('messageCreate',async(message)=>{
	if (message.author.id!='804194370018344961') return;
	//console.log(message)
	if (message.content.startsWith("!send")) {
		const channel = client.channels.cache.get('1069175615841910804');
		channel.send(message.content.replaceAll("!send",""));
	}
});


//유저 입장시 미인증 역할 추가
client.on('guildMemberAdd', async (member) => {
	log(`${member} 입장`);
	const role = member.guild.roles.cache.get('1291568238630797428');
	await member.roles.add(role);
	log(`[\x1b[32m✔\x1b[0m] ${member.user.tag}님에게 역할을 지급했습니다`);
});

client.on('messageCreate',async(message)=>{
	//console.log(message)
	if (message.content.startsWith("!whois")) {
		if (!message.member.roles.cache.has("1376787679458627717")){
			message.reply(`${message.author} 이 명령을 수행할 권한이 부족합니다`)
			return;
		}
		var username = message.content.replaceAll("!whois","")
		//const channel = client.channels.cache.get('1397084660005077003');
		//channel.send(message.content.replaceAll("!whois",""));
		message.channel.send(`${user}님의 인증정보를 조회합니다..`)
		try{
			const jsonData = JSON.parse(user_data);
			const users = jsonData.users;
			
			users.forEach(user => {
				if (user.uuid==username){
					message.channel.send(`${user}`)
				}
				messagmessagech.send(`${user}`)
			});
			// fs.readFile('user-data.json', 'utf8', function(err, data) {
			// 	message.channel.send(`${data.minecraft}`)
			// 	console.log(JSON.parse(data).user)
			// });

		}catch(err){
			message.channel.send(`${user} 유저를 찾을 수 없습니다 ${err}`)
		}
	}
});

//유저가 보낸 메시지 검사
client.on('messageCreate', async(message,member,guild) => {
	if (message.author.bot) return; //봇 무시
	if (message.content===``) return;
	if (!(message.channel.id == '976794485528875008' || message.channel.id == '1401046975151083620')) return; //인증체널 외에는 무시

	const iskorean = new RegExp("[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]");
 
	if (message.content.match(iskorean)){
		message.reply("-# 메시지에 한글이 포함되어 있습니다 닉네임만 작성해주십시오")
		return;
	}

    log(`${message.author.username}(${message.author.id}) > ${message}`) //남긴 메시지 표시
    //모장api로 올바른 UUID인지 물어보기
    //message.content.trim() <- 문자열 좌우 공백을 제거
    try {
        const response = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${message.content.trim()}`); //모장 api로 요청을 보낸다음 정보를 response로 저장
        console.log(response.data) //json으로 뽑아줌
        //console.log(response.data.id) //UUID만 뽑아줌
		message.reply(`-# ✅ 인증완료 ${response.data.id}`)
		
		log(`${message.author.username} 인증완료`)

    	await message.member.roles.add('976794246742966302');
		await message.member.roles.remove('1291568238630797428');
		
    } catch (error){
        //error
		
		if (error==`AxiosError: Request failed with status code 404`){
			message.reply(`-# **올바르지 않는 닉네임** | 또는 api에서 오류가 발생하였습니다 <@&1221809675293425746>`)
		}else{
			message.reply(`-# 올바르지 않는 닉네임 | 또는 내부에서 오류가 발생하였습니다 <@&1221809675293425746>\n-# ${error}`)
			console.log(error)
		}

    }
    
    
});

client.login(token);
