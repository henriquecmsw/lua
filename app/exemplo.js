// load env variables from the .env file
require('dotenv-extended').load()

const builder = require('botbuilder')
const restify = require('restify')
const request = require('request')


//=========================================================
// Bot Setup
//=========================================================

const port = process.env.port || process.env.PORT || 3978
const server = restify.createServer()
server.listen(port, () => {
    console.log(`${server.name} listening to ${server.url}`)
})

const connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
})

const bot = new builder.UniversalBot(connector)
bot.set('storage', new builder.MemoryBotStorage())
server.post('/api/messages', connector.listen())

//=========================================================
// LUIS Dialogs
//=========================================================

//const recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL)
const recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/8eb7fa40-3ca9-4c5c-9f1c-2d047118f29d?subscription-key=71b87ed0a81c4f5d9775043a2e820275&verbose=true&timezoneOffset=-180&q=')



const intents = new builder.IntentDialog({
    recognizers: [recognizer]
})

// Trata a intenção cotacao - atenção com o nome da intent que é case-sensitive
intents.matches('Status', (session, args, next) => {
    const numero = builder.EntityRecognizer.findAllEntities(args.entities, 'numero_de_chamado')
    console.log('numero == '+ numero) 
    //session.beginDialog('statuschamado')
})

bot.dialog('statuschamado', [

    
    

    (session, results) => {
        session.conversationData.numero_chamado = responses.numero_chamado;
        endpoint = 'https://webappchamado.azurewebsites.net/chamados/' + session.conversationData.numero_chamado

        console.log('end point '+endpoint)    
        session.send('Aguarde um momento enquanto localizo seu chamado')
        request(endpoint, (error, response, body) => {
            if(error || !body)
                return session.send('Ocorreu algum erro, tente novamente mais tarde.')

            const chamadoJson = JSON.parse(body);
            return session.send(chamadoJson)
        })
        
       
    }
 ])

// Trata a intenção None - atenção com o nome da intent que é case-sensitive
intents.onDefault((session, args) => {
    session.send(`Desculpe, não pude compreender **${session.message.text}**`)
})

bot.dialog('/', intents)