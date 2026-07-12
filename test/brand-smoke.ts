import { checkBrand } from "../src/enrich/brand.js";
for (const d of ["royalmail-redelivery.info","paypa1.com","secure-paypal-login.com","google.com","arnazon.com","coinbase-wallet-verify.xyz","applepie.com","okx.com"]) {
  console.log(d, "->", checkBrand(d).map(e => `${e.severity}: ${e.claim}`));
}
