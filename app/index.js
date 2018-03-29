// load env variables from the .env file
require('dotenv-extended').load()
const formflowbotbuilder = require('formflowbotbuilder')
const builder = require('botbuilder')
const restify = require('restify')
const moment = require('moment')
const path = require('path')

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

function saudacao(){
    const split_afternoon = 12
    const split_evening = 17
    const currentHour = parseFloat(moment().utc().format('HH'))
    if(currentHour >= split_afternoon && currentHour <= split_evening){
        return 'Boa noite'
    }
    else if (currentHour >= split_evening) {
        return 'Boa tarde'
    }
    return 'Bom dia'
}

//=========================================================
// LUIS Dialogs
//=========================================================

const recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/8eb7fa40-3ca9-4c5c-9f1c-2d047118f29d?subscription-key=71b87ed0a81c4f5d9775043a2e820275&verbose=true&timezoneOffset=-180&q=')

const intents = new builder.IntentDialog({
    recognizers: [recognizer]
})

intents.matches('None', (session, args, next) => {
    session.send('Desculpe, mas não comprendi sua solicitação,\n Lembre-se sou um robo, minhas ações são limitadas\n')

    const message = '* **Duvidas de serviços disponiveis**\n' +
                    '* **Abertura de chamados**\n' +
                    '* **Consultar status de chamados abertos**'
                    session.send(message)

})

intents.matches('recepcao', (session, args, next) => {
    msg = 'Olá, sou um robo e sera um prazer atendelo'
    session.send(msg)
})

intents.matches('Problemas', (session, args, next) => {
    var msg = 'Infelizmente para esta pergunta ainda não tenho resposta,\n ' +
              'mas podemos abrir um chamado,\n'                             
    session.send( msg )
    session.beginDialog('cadastrocliente')
})

intents.matches('consciencia', (session, args, next) => {
    session.send('Sou um assistente virtual de helpdesk, ao seu dispor')
})

/*intents.matches('Chamado', (session, args, next) => {
    session.beginDialog('cadastrocliente')

})*/

intents.matches('Status', (session, args, next) => {
    session.beginDialog('statuschamado')

})
//=======================================================



//=========================================================
// Dialogs
//=========================================================
const dialogDadosCliente = 'formCliente';
const formDadosCliente = path.join(__dirname, '\\data\\ModelFormCliente.json')
formflowbotbuilder.executeFormFlow(formDadosCliente, bot, dialogDadosCliente, (err, responses) => {
    if(err)
        return console.log(err)
    bot.dialog('cadastrocliente', [

       (session) => {
            if(!session.userData.reload)
                session.send('Vou precisar que me cofirme alguns dados para dar continuidade com o chamado')
                session.beginDialog(dialogDadosCliente)
       },

       (session, results) => {
           session.conversationData.nome = responses.nome;
           session.conversationData.email = responses.email;
           session.conversationData.contrato = responses.contrato;
           session.conversationData.produto = responses.produto;
           session.conversationData.descricao_problema = responses.descricao_problema;
           const questao = `Confirme os dados a baixo?\n`
                        + `* Nome: ${responses.nome}\n` 
                        + `* E-mail: ${responses.email}\n`
                        + `* Contrato: ${responses.contrato}\n`
                        + `* Produto: ${responses.produto}\n`
                        + `* Descricao Problema: ${responses.descricao_problema}`
                        
            const options = {
                listStyle: builder.ListStyle.button,
                retryPrompt: 'Deculpa, não entendi, selecione uma das opções'
            }
            builder.Prompts.confirm(session, questao, options)
       },
       (session, results) => {
            if(results.response){
                session.save()
                return session.send('Muito obrigado, só mais alguns instante sera gerado um numero de chamado')
                //TODO sender chamdo para app
            }
            session.userData.reload = true;
            session.send('Tudo bem, vamos tentar novamente')
            session.replaceDialog('cadastrocliente')
        }
    ])
})

bot.dialog('statuschamado', [

    (session) => {
         if(!session.userData.reload)
             return session.send('Vou precisar que me cofirme o numero do chamado')
    },

    (session, results) => {
        session.conversationData.numero_chamado = responses.numero_chamado;
        //TODO GET CHAMADO API
        console.log(session.conversationData.numero_chamado)
        return session.send('so mais um instante que irei localizer seu chamado ' + session.conversationData.numero_chamado)             
    }
 ])


bot.on('conversationUpdate', (update) => {
    if (update.membersAdded) {
        update.membersAdded.forEach( (identity) => {
            if (identity.id === update.address.bot.id) {
                bot.loadSession(update.address, (err, session) => {
                    if(err)
                        return err
                    const message = 'Olá, Sou um assistente virtual de helpdesk, poderei lhe ajudar da seguinte maneira:\n' +
                    '* **Duvidas de serviços disponiveis**\n' +
                    '* **Abertura de chamados**\n' +
                    '* **Consultar status de chamados abertos**'
                    session.send(message)
                })
            }
        })
    }
})

bot.dialog('/', intents)