const stripe = require('stripe');
const express = require('express');
const sgMail = require('@sendgrid/mail');

// --- Configuración de las Claves (se leen desde Render) ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Inicializamos todo
const app = express();
const stripeClient = stripe(STRIPE_SECRET_KEY);
sgMail.setApiKey(SENDGRID_API_KEY);

// --- Función para enviar el email ---
async function sendActivationEmail(customerEmail) {
  const msg = {
    to: customerEmail,
    // ¡¡IMPORTANTE!! CAMBIA ESTE EMAIL por el tuyo verificado en SendGrid
    from: 'info@nexuscopier.com', 
    subject: 'Gracias por su compra. Active su licencia de Nexus',
    html: `
      <h1>Gracias por su compra en Nexus</h1>
      <p>Por favor, revise su bandeja de correo electrónico para completar la activación de su licencia.</p>
      <p>Su siguiente paso es... (Aquí puedes poner las instrucciones o el enlace)</p>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email de activación enviado a ${customerEmail}`);
  } catch (error) {
    console.error('Error enviando email con SendGrid:', error);
  }
}

// --- El Endpoint del Webhook ---
// Stripe necesita el "raw body" (cuerpo en crudo), por eso usamos express.raw
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    // 1. Verificar que la petición viene de Stripe (usando el secreto)
    event = stripeClient.webhooks.constructEvent(request.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Error de firma del Webhook: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Si la firma es válida, procesamos el evento
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;

    if (customerEmail) {
      console.log(`Pago exitoso de ${customerEmail}. Iniciando envío de email.`);
      // 3. Llamar a nuestra función de enviar email
      await sendActivationEmail(customerEmail);
    } else {
      console.log('Pago exitoso, pero no se encontró email en la sesión de Stripe.');
    }
  }

  // 4. Responder a Stripe que todo salió bien (para que no siga reintentando)
  response.status(200).send();
});

// --- Iniciar el servidor ---
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));