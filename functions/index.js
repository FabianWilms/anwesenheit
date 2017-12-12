'use strict';

const Assistant = require('actions-on-google').ApiAiAssistant;
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

    const assistant = new Assistant({request: request, response: response});

    let actionMap = new Map();
    actionMap.set(GET_ALL_INTENT, getAllAnwesenheiten);
    actionMap.set(GET_SINGLE_INTENT, getSingleAnwesenheit);
    assistant.handleRequest(actionMap);

    function getAllAnwesenheiten(assistant) {
        console.log('getAllAnwesenheiten');
        anwesenheiten.once("value", (snapshot) => {        
            var mitarbeiterWithStatus = getMitarbeiterWithStatus(snapshot.val());
            var response = '<speak>';
            
            response += getResponseTextForStatus(mitarbeiterWithStatus[0], 0);
            response += getResponseTextForStatus(mitarbeiterWithStatus[1], 1);
            response += getResponseTextForStatus(mitarbeiterWithStatus[2], 2);

            response += '</speak>';
            assistant.tell(response);
        })
    }

    function getSingleAnwesenheit(assistant) {
        const mitarbeiterName = assistant.getArgument(SINGLE_PARAM);

        console.log(`Mitarbeiter: ${mitarbeiterName}`);

        assistant.tell('Aktuell kann ich dir das leider noch nicht sagen. Stups mal Fabian an, damit er das Feature fertig implementiert.');
    }

    /**
     * Returns an Array with the status as an index. At each index there is the name of the person with this status.
     */
    function getMitarbeiterWithStatus(data) {
        var returnData = [ [], [], [] ];
        for(var key in data) {
            returnData[parseInt(data[key].status)].push(data[key].name);
        }
        console.log(returnData);
        return returnData;
    }

    /**
     * Returns a Text with the names and the text corresponding to the status of each mitarbeiter.
     */
    function getResponseTextForStatus(mitarbeiterNamen, status) {
        var count = mitarbeiterNamen.length;

        if(count === 0) {
            return "";
        }

        var returnText = "";
        if(count === 1) {
            returnText += `${mitarbeiterNamen[0]} ist `;
        } else if(count === 2) {
            returnText += `${mitarbeiterNamen[0]} und ${mitarbeiterNamen[1]} sind `
        } else if(count > 2) {
            for(var i = 0; i < count; i++) {
                if(i === count-1) {
                    returnText += ` und ${mitarbeiterNamen[i]} sind `;
                } else {
                    returnText += `${mitarbeiterNamen[i]},`;
                }
            }
        }

        switch(status) {
            case 0:
                returnText += " anwesend.";
                break;
            case 1:
                returnText += " im Haus unterwegs.";
                break;
            case 2:
                returnText += " abwesend.";
                break;
            default:
                returnText += " in einem merkwürdigen Zustand. Vielleicht in einer Paralleldimension?"
                break;
        }
        
        console.log(returnText);
        return returnText;
    }
});