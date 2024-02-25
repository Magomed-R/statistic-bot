import IUser from "./IUser";

interface IDatabase {
    users: {
        [key: IUser["id"]]: IUser
    };
}

export default IDatabase