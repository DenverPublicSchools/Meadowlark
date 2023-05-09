
// Shim for WithID type used in Mongo library
export type WithId<T> = T & {
    _id: string;
};