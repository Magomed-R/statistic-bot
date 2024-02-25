import IDatabase from "../Interfaces/IDatabase";
import IUser from "../Interfaces/IUser";
import fs from "fs"

const path = 'database/data.json'

class UserModel {
    public async find(id: string) {
        const data: IDatabase = (await JSON.parse(fs.readFileSync(path, "utf-8")))
        return data.users[id]
    }

    public async all(): Promise<IUser[]> {
        return (await JSON.parse(fs.readFileSync(path, "utf-8"))).users
    }

    public async save(user: IUser) {
        const database: IDatabase = await JSON.parse(fs.readFileSync(path, "utf-8"));
        database.users[user.id] = user;
        fs.writeFileSync(path, JSON.stringify(database), "utf-8");
    }
}

const User = new UserModel()

export default User