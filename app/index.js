// load env variables from the .env file
require('dotenv-extended').load()
const formflowbotbuilder = require('formflowbotbuilder')
const builder = require('botbuilder')
const restify = require('restify')
const moment = require('moment')
const path = require('path')
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

intents.matches('Recepcao', (session, args, next) => {
    msg =  saudacao() +  ', Olá tudo bem, sou um robo e será um prazer atendelo'
    session.send(msg)
})

intents.matches('Gratidao', (session, args, next) => {
    msg = 'Imagina é sempre um prazer ser util, ' + saudacao() + ' até mais'     
    session.endConversation(msg);
})

intents.matches('Problemas', (session, args, next) => {            
    var msg = 'Infelizmente para esta pergunta ainda não tenho resposta,\n ' +
              'Podemos abrir um chamado\n'         

    session.send( msg )
    session.beginDialog('cadastrocliente')
})

intents.matches('Consciencia', (session, args, next) => {
    session.send('Sou um assistente virtual de helpdesk, ao seu dispor')
})

intents.matches('AbrirChamado', (session, args, next) => {
    session.send('Eu posso lhe ajudar com isso.')
    session.beginDialog('cadastrocliente')
    
})

intents.matches('StatusChamado', (session, args, next) => {

    const numero = builder.EntityRecognizer.findEntity(args.entities, 'numero_chamado')
    console.log( 'entities = ' + numero )
    if(numero == null){
        return session.send("Certifique-se de digitar o numero de chamado, corretamente.")
    }
    
    //TODO GET REQUEST API CHAMADO
    //const endpoint = `${process.env.COTACAO_ENDPOINT}${moedas}`
    const endpoint = 'https://webappchamado.azurewebsites.net/chamados/' + numero.entity
    session.send('Aguarde um momento enquanto localizo seu chamado')
    request(endpoint, (error, response, body) => {
        if(error || !body)
            return session.send('Ocorreu algum erro, tente novamente mais tarde.')
        const jsonStatus = JSON.parse(body);
        msg = jsonStatus['mensagem']
        
        status = jsonStatus['status']
        if(typeof status === 'undefined'){
            session.send(  msg + ", verifique se digitou correntamente e tente mais uma vez."  )
        }else{
            session.send('Status do chamado ' + numero.entity + ': ' + status)
        }                
    })    
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
                session.send('Mas antes vou precisar que me cofirme alguns dados.')
                session.beginDialog(dialogDadosCliente)
       },

       (session, results) => {

        session.dialogData.nome = responses.nome
        session.dialogData.email = responses.email
        session.dialogData.contrato = responses.contrato
        session.dialogData.produto = responses.produto
        session.dialogData.descricao_problema = responses.descricao_problema
                   
           const questao = `A informação a baixo está correta?\n`
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
                session.send('Muito obrigado, só mais alguns instante que será gerado um número de chamado')                                                
                const endpoint = 'https://webappchamado.azurewebsites.net/novo/'+responses.produto+'/'+responses.nome +'/'+responses.descricao_problema
                console.log('endpoint = ' + endpoint)     

                request(endpoint, (error, response, body) => {
                    if(error || !body)
                        return session.send('Ocorreu algum erro, tente novamente mais tarde.')
                        
                    const jsonStatus = JSON.parse(body);
                    erro_code = jsonStatus['code']
                    num_chamado = jsonStatus['num_chamado']
                    if(typeof num_chamado === 'undefined'){
                        return session.send(  erro_code + ", Ocorreu algum erro, tente novamente mais tarde."  )
                    }else{
                       return session.send('Chamado aberto com sucesso, anote o número para acompanhar os status: ' + num_chamado )
                    }                
                })    
            }else{
                session.userData.reload = true;
                session.send('Tudo bem, vamos tentar novamente')
                session.replaceDialog('cadastrocliente')
            }
        }
    ])
})



bot.on('conversationUpdate', (update) => {
    if (update.membersAdded) {
        update.membersAdded.forEach( (identity) => {
            if (identity.id === update.address.bot.id) {
                bot.loadSession(update.address, (err, session) => {
                    if(err)
                        return err
                    const message = 'Olá, Sou um assistente virtual de helpdesk, poderei lhe ajudar da seguinte maneira:\n' +                    
                    '* **Abertura de chamados**\n' +
                    '* **Consultar status de chamados abertos**'
                    session.send(message)
                })
            }
        })
    }
})

bot.dialog('/', intents)