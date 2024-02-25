export default interface IChannel {
    chats: {
        className: "Channel";
        classType: "constructor";
        flags: number;
        creator: boolean;
        left: boolean;
        broadcast: boolean;
        verified: boolean;
        megagroup: boolean;
        restricted: boolean;
        signatures: boolean;
        min: boolean;
        scam: boolean;
        hasLink: boolean;
        hasGeo: boolean;
        slowmodeEnabled: boolean;
        callActive: boolean;
        callNotEmpty: boolean;
        fake: boolean;
        gigagroup: boolean;
        noforwards: boolean;
        joinToSend: boolean;
        joinRequest: boolean;
        forum: boolean;
        flags2: number;
        storiesHidden: boolean;
        storiesHiddenMin: boolean;
        storiesUnavailable: boolean;
        id: number;
        accessHash: number;
        title: string;
        username: string;
    };
}
