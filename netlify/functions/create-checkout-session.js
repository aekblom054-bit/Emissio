// netlify/functions/create-checkout-session.js
//
// Den här funktionen körs på Netlifys servrar (inte i besökarens
// webbläsare), så det är hit den hemliga Stripe-nyckeln hör hemma.
// Den tar emot varukorgen från hemsidan, skapar en Stripe Checkout-
// session och skickar tillbaka en länk som besökaren skickas vidare till.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { cart, carrier } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Varukorgen är tom.' }) };
    }

    // Bygg upp raderna Stripe ska visa på betalsidan, en per produkt/storlek.
    const line_items = cart.map((item) => ({
      price_data: {
        currency: 'sek',
        product_data: {
          name: `${item.name} (${item.size})`,
        },
        unit_amount: Math.round(item.price * 100), // Stripe räknar i ören
      },
      quantity: item.qty,
    }));

    // Fraktkostnad som en egen rad, baserat på valt fraktbolag.
    const shippingCosts = { dhl: 79, postnord: 59, gratis: 0 };
    const shippingLabel = { dhl: 'Frakt (DHL)', postnord: 'Frakt (PostNord)', gratis: 'Frakt (gratis)' };
    const shippingPrice = shippingCosts[carrier] ?? 0;
    if (shippingPrice > 0) {
      line_items.push({
        price_data: {
          currency: 'sek',
          product_data: { name: shippingLabel[carrier] || 'Frakt' },
          unit_amount: shippingPrice * 100,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${process.env.URL}/tack.html`,
      cancel_url: `${process.env.URL}/avbrutet.html`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
