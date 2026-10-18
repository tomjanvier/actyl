// Les envois immédiats doivent rester bornés et ne jamais tronquer l’audience.
export const EMAIL_BATCH_LIMIT = 500;
export const EMAIL_BATCH_ERROR = `Cette audience dépasse ${EMAIL_BATCH_LIMIT} destinataires. Affinez le segment avant l’envoi ; aucun email n’a été envoyé.`;
