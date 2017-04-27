const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
let human = require('human-time');
let humanize = require('humanize');
let CACHE = new Set();


let CHATS = new Set();

function getUpcomingSessions(data) {
    data.Sessions.forEach((el) => {
        let s = el.StartDate;
        el.realStartDate = new Date(parseInt(s.substr(6, s.length - 8)))
    });
    return data.Sessions.filter((el) => {
        return el.realStartDate > new Date();
    })
}
function sessionToString(session) {
    let day = session.realStartDate.getDay();
    let month = session.realStartDate.getMonth();
    let year = session.realStartDate.getFullYear();
    let html = `<a href="https://cma.paris.fr/#displayElement(${session.ElementId})">${session.Title}</a>`;
    let response = `${day}/${month}/${year} (${human(session.realStartDate)})
${html}`;
    return response;
}

function fetchRegular() {
    getCourses(function (data) {
        let upcomingMap = {};
        let upcoming = new Set(getUpcomingSessions(data).map((el) => {
            upcomingMap[el.Id] = el;
            return el.Id
        }));
        let newIds = new Set(Array.from(upcoming).filter(x => !CACHE.has(x)));

        newIds.forEach((el) => {
            CACHE.add(el);
        });
        let newElements = Array.from(newIds).map((el) => {
            return upcomingMap[el];
        });
        console.log(CACHE);
        if (Array.from(newElements).length) {
            CHATS.forEach((e) => {
                bot.sendMessage(e, 'NEW COURSES!');
                bot.sendMessage(e, newElements.map(sessionToString).join('\n\n'), {parse_mode: 'HTML'});
            });
        }

    });
}


const token = '325397971:AAFv1i-spBvobtESXmPCZRxvrXUk0MOHSS4';
const bot = new TelegramBot(token, {polling: true});


// messages.
let addNewChat = function (chatId) {
    if (!CHATS.has(chatId)) {
        bot.sendMessage(chatId, 'Added to update list :)');
    }
    CHATS.add(chatId);
};


let getCourses = function (action, chatId) {
    https.get('https://cma.paris.fr/Home/GetTree', (res) => {
        let dataString = "";
        res.on('data', (d) => {
            dataString += d;
        });
        res.on('end', (d) => {
            let parse;
            try {
                parse = JSON.parse(dataString.substr(15));
                action(parse);
            } catch (e) {
                console.warn("Couldn't parse json: ", e);
                if (chatId) {
                    bot.sendMessage(chatId, "Couldn't parse json: " + e)
                }
            }
        });

    }).on('error', (e) => {
        console.error(e);
    });
};
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    addNewChat(chatId);

    bot.sendMessage(chatId, 'Serving upcoming courses...');
    getCourses(function (data) {
        let response = getUpcomingSessions(data).sort((one, other) => one.realStartDate - other.realStartDate).map(sessionToString).join('\n\n');
        bot.sendMessage(chatId, response, {parse_mode: 'HTML'});
    }, chatId);


});

setTimeout(function () {
    setInterval(() => {
        if (Array.from(CHATS).length > 0) {
            fetchRegular();
        }
    }, 1000 * 60 * 2);
}, 10000);
