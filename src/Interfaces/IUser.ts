interface IUser {
    id: string;
    channels: {
        url: string;
        needNewsletter: boolean;
        id: number | BigInteger;
        title: string;
        private: boolean
    }[];
    subscription: boolean;
    expiration: number;
    agree_terms: boolean;
    channelNum: number
    unlimited: boolean
}

export default IUser;
