'use strict';

const Assistant = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const anwesenheiten = admin.database().ref('/anwesenheiten');

// API.AI Intent names
const GET_ALL_INTENT = 'GET_ALL_ANWESENHEITEN';
const GET_SINGLE_INTENT = 'GET_SINGLE_ANWESENHEIT';

// Context Parameters
const SINGLE_PARAM = 'mitarbeiter';

exports.anwesenheitForAssistant = functions.https.onRequest((request, response) => {
    console.log('headers: ' + JSON.stringify(request.headers));
    console.log('body: ' + JSON.stringify(request.body));

    const assistant = new Assistant({ request: request, response: response });

    let actionMap = new Map();
    actionMap.set(GET_ALL_INTENT, getAllAnwesenheiten);
    actionMap.set(GET_SINGLE_INTENT, getSingleAnwesenheit);
    assistant.handleRequest(actionMap);

    function getAllAnwesenheiten(assistant) {
        console.log(">>>#getAllAnwesenheiten");
        anwesenheiten.once("value", (snapshot) => {
            console.log(snapshot);
            var mitarbeiterWithStatus = getMitarbeiterWithStatus(snapshot.val());

            var respText = '';
            respText += getResponseTextForStatus(mitarbeiterWithStatus[0], 0);
            respText += getResponseTextForStatus(mitarbeiterWithStatus[1], 1);
            respText += getResponseTextForStatus(mitarbeiterWithStatus[2], 2);
            respText += getResponseTextForStatus(mitarbeiterWithStatus[3], 3);

            console.log("<<<#getAllAnwesenheiten");
            if(request.body.originalRequest.source == "slack") {
                response.json({'speech': respText});
            } else {
                assistant.tell(respText);
            }
        })
    }

    function getSingleAnwesenheit(assistant) {
        console.log(">>>#getSingleAnwesenheit");
        const mitarbeiterName = assistant.getArgument(SINGLE_PARAM);

        console.log(`Mitarbeiter: ${mitarbeiterName}`);

        var string = `Nein, ich weiß noch nicht wann ${mitarbeiterName} da ist. Mei hetz mi ned!`

        let botResponse = {
            'speech': string,
            'displayText': string
        };

        console.log("<<<#getSingleAnwesenheit");
        response.json(botResponse);
    }

    /**
     * Returns an Array with the status as an index. At each index there is the name of the person with this status.
     */
    function getMitarbeiterWithStatus(data) {
        console.log(">>>#getMitarbeiterWithStatus");
        console.log(data);
        // Für jeden Status den wir kennen, ein Array
        // [Anwesend, Unterwegs, Abwesend, Telearbeit]
        // Alle anderen Status werden ignoriert
        var returnData = [[], [], [], []];
        for (var key in data) {
            var tmpStatus = parseInt(data[key].status);
            if(tmpStatus <= 3) {
                returnData[tmpStatus].push(data[key].name);
            }
        }
        console.log(returnData);
        console.log("<<<#getMitarbeiterWithStatus");
        return returnData;
    }

    /**
     * Returns a Text with the names and the text corresponding to the status of each mitarbeiter.
     */
    function getResponseTextForStatus(mitarbeiterNamen, status) {
        console.log(">>>#getResponseTextForStatus");
        var count = mitarbeiterNamen.length;

        if (count === 0) {
            return "";
        }

        var returnText = "";
        if (count === 1) {
            returnText += `${mitarbeiterNamen[0]} ist`;
        } else if (count === 2) {
            returnText += `${mitarbeiterNamen[0]} und ${mitarbeiterNamen[1]} sind`
        } else if (count > 2) {
            for (var i = 0; i < count; i++) {
                if (i === count - 1) {
                    returnText += ` und ${mitarbeiterNamen[i]} sind`;
                } else {
                    returnText += `${mitarbeiterNamen[i]},`;
                }
            }
        }

        switch (status) {
            case 0:
                returnText += " anwesend. ";
                break;
            case 1:
                returnText += " im Haus unterwegs. ";
                break;
            case 2:
                returnText += " abwesend. ";
                break;
            case 3:
                returnText += " in Telearbeit. ";
                break;
            default:
                returnText += " in einem merkwürdigen Zustand. Vielleicht in einer Paralleldimension? "
                break;
        }

        console.log(returnText);
        console.log("<<<#getResponseTextForStatus");
        return returnText;
    }
});

const nodemailer = require('nodemailer');
// Configure the email transport using the default SMTP transport and a GMail account.
// For Gmail, enable these:
// 1. https://www.google.com/settings/security/lesssecureapps
// 2. https://accounts.google.com/DisplayUnlockCaptcha
// For other types of transports such as Sendgrid see https://nodemailer.com/transports/
// TODO: Configure the `gmail.email` and `gmail.password` Google Cloud environment variables.
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: gmailEmail,
        pass: gmailPassword,
    },
});

const APP_NAME = 'I1.064 Anwesenheit'

/**
 * Horcht auf Statusänderungen aller User.
 * Wenn ein User wieder Anwesend (status==0) ist, wird eine Mail an alle seine Subscriber gesendet.
 */
exports.sendAnwNotifications = functions.database.ref('/anwesenheiten/{personId}/status').onWrite((event) => {

    if (event.data.val() != 0)
        return 0;

    return event.data.ref.parent.once('value', personSnap => {
        const name = personSnap.val().name;

        personSnap.child('subscriptions').forEach(subMail => {
            sendAnwNotification(subMail.val(), name)
        });
        event.data.ref.parent.child('subscriptions').remove();
    })
});

/**
 * Sendet eine E-Mail mit dem Hinweis, welche Person (name) wieder anwesend ist.
 * @param {string} email Die Adresse, an die die Mail versendet werden soll.
 * @param {string} name Die Person, die wieder Anwesend ist.
 */
function sendAnwNotification(email, name) {
    const mailOptions = {
        from: `${APP_NAME} <noreply@firebase.com>`,
        to: email,
    };

    mailOptions.subject =`${name} is wieder anwesend!`;
    mailOptions.text = `${name} ist seit ${new Date()} wieder im Raum I1.064 verfügbar.`;
    return mailTransport.sendMail(mailOptions).then(() => {
        return console.log('New Anw Noti send to: ', email);
    });
};