import { PrismaClient, User } from "@prisma/client";

let usernum = 0;
export async function createUser(
  prisma: PrismaClient
): Promise<User> {
  const name = `user${usernum++}`;
  return prisma.user.create({
    data: {
      username: name,
      password: name,
    },
  });
}
