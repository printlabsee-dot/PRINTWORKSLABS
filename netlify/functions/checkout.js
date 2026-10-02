const Stripe = require("stripe");
const LAMPS = {1:["Moon lamp",19],2:["Swirl lamp",30],3:["Hourglass lamp",35]};
const FREE_FROM = 80;
const GIFT = 3;
const PROMOS = {WELCOME10:10,START:10};
const EU = "AT BE BG HR CY CZ DK DE ES FR GR HU IE IT LU MT NL PL PT RO SK SI SE".split(" ");
const ship = c => c==="EE"?3 : ["LV","LT","FI"].includes(c)?5 : EU.includes(c)?10 : 25;

exports.handler = async (event) => {
  try {
    const b = JSON.parse(event.body);
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const items = b.items.filter(i => LAMPS[i.id] && i.qty > 0);
    if (!items.length) return { statusCode: 400, body: "{}" };
    const sub = items.reduce((a,i)=>a+LAMPS[i.id][1]*i.qty,0);
    const line_items = items.map(i => ({quantity:i.qty,price_data:{currency:"eur",unit_amount:LAMPS[i.id][1]*100,product_data:{name:LAMPS[i.id][0]}}}));
    const d = sub >= FREE_FROM ? 0 : ship(b.country);
    if (d) line_items.push({quantity:1,price_data:{currency:"eur",unit_amount:d*100,product_data:{name:"Delivery"}}});
    const m = {}; for (const k in b.meta) m[k] = String(b.meta[k]||"").slice(0,450);
    const params = {mode:"payment",customer_email:b.email,line_items,metadata:m,payment_intent_data:{receipt_email:b.email},success_url:b.origin+"/?paid=1",cancel_url:b.origin};
    const disc = Math.round(sub*(PROMOS[String(b.promo||"").trim().toUpperCase()]||0));
    if (disc) { const c = await stripe.coupons.create({amount_off:disc,currency:"eur",duration:"once"}); params.discounts = [{coupon:c.id}]; }
    const s = await stripe.checkout.sessions.create(params);
    return { statusCode: 200, body: JSON.stringify({ url: s.url }) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
};
