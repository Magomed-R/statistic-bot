import { Scenes, Context } from "telegraf";


interface StoreSession extends Scenes.SceneSession {
    cid?: number;
}

export default interface StContext extends Context {
    session: StoreSession;
    scene: Scenes.SceneContextScene<StContext>;
}