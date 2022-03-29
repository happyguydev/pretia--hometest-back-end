const argon2 = require("argon2");
const PrismaClient = require("@prisma/client").PrismaClient;

async function go() {
  const prisma = new PrismaClient();
  await prisma.user.create({
    data: {
      username: "Awesome",
      password: await argon2.hash("developer"),
    },
  });
}

go().then(() => console.log("seeding done"));
