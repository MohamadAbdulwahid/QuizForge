import {seedQuizzes} from "./quizzes.seed.ts";
import {seedUsers} from "./user.seed.ts";

export type SeedFunction = () => Promise<string>;

const seedDb = async () => {
    console.log("Seeding database...");

    try {
        console.log("Adding independent data...")
        const userResult = await seedUsers();
        console.log(`${userResult}`);

        const quizResult = await seedQuizzes();
        console.log(`${quizResult}`);

        console.log("Database seeding process finished!");
        process.exit(0);
    } catch(err) {
        console.error("Critical error during seeding:", err);
        process.exit(1);
    }
}

seedDb();