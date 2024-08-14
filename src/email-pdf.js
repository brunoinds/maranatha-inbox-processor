


export function generateHtml(threadData){
    const messages = threadData.messages.map((message) => {
        const html = `
            <hr>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="message">
                <tbody>
                    <tr>
                        <td>
                            <font size="-1"><b>Desde: ${message.from}</b></font>
                        </td>
                        <td align="right">
                            <font size="-1">${message.date}</font>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding-bottom: 4px;">
                            <font size="-1" class="recipient">
                                <div>Para: ${message.to}</div>
                            </font>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <table width="100%" cellpadding="12" cellspacing="0" border="0">
                                ${message.bodyHtml}

                                <br>

                                ${(() => {
                                    if (message.attachments.length > 0) {
                                        const html = `
                                            <div style="width:200px;border-top:2px #AAAAAA solid"></div>
                                            <table class="att" cellspacing="0" cellpadding="5" border="0">
                                                <tbody>
                                                    <tr>
                                                        <td colspan="2"><b style="padding-left:3">${message.attachments.length} archivos adjuntos</b></td>
                                                    </tr>
                                                    ${(() => {
                                                        return message.attachments.map((attachment) => {
                                                            return `
                                                                <tr>
                                                                    <td>
                                                                        <table cellspacing="0" cellpadding="0">
                                                                            <tbody>
                                                                                <tr>
                                                                                    <td>
                                                                                        <img width="16" height="16" src="https://cdn-icons-png.freepik.com/256/13558/13558989.png?semt=ais_hybrid">
                                                                                    </td>
                                                                                    <td width="7"></td>
                                                                                    <td>
                                                                                        <b>${attachment.fileName}</b>
                                                                                        <br>${attachment.size}bytes 
                                                                                    </td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                            `
                                                        }).join('');    
                                                    })()}
                                                </tbody>
                                            </table>
                                        `

                                        return html;
                                    }else{
                                        return ''
                                    }
                                })()}
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        `

        return html;
    }).join('');

    const html = `
        <!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "https://www.w3.org/TR/html4/strict.dtd">
        <html lang="pt-BR">
            <head>
                <meta http-equiv=Content-Type content="text/html; charset=UTF-8">
                <style type="text/css" nonce="6EES61ykLCKy-dVWx6ZCXA">
                    body,td,div,p,a,input {font-family: arial, sans-serif;}
                </style>
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <link rel="shortcut icon" href="https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico" type="image/x-icon">
                <title>Gmail - Fwd: MRNT RP - 627.10 USD, Boletas Cinthya PS</title>
                <style type="text/css" nonce="6EES61ykLCKy-dVWx6ZCXA">
                    body, td {font-size:13px} a:link, a:active {color:#1155CC; text-decoration:none} a:hover {text-decoration:underline; cursor: pointer} a:visited{color:##6611CC} img{border:0px} pre { white-space: pre; white-space: -moz-pre-wrap; white-space: -o-pre-wrap; white-space: pre-wrap; word-wrap: break-word; max-width: 800px; overflow: auto;} .logo { left: -7px; position: relative; }
                </style>
        </head>
        <body>
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tbody><tr height="14px"><td width="143"><img src="https://maranatha.org/wp-content/themes/maranatha/images/maranatha-logo-color.svg" width="143" height="59" alt="Gmail" class="logo"></td><td align="right"><font size="-1" color="#777"><b></b></font></td></tr></tbody></table>
            <hr>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tbody>
                    <tr><td><font size="+1"><b>${threadData.snippet}</b></font><br><font size="-1" color="#777">${threadData.messages.length} mensajes</font></td></tr>
                </tbody>
            </table>
            ${messages}
        </body>
        </html>
    `

    return html;
}