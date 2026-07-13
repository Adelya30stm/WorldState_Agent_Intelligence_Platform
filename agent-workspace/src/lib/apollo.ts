import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

const httpLink = new HttpLink({ uri: '/api/v1/graphql', credentials: 'include' });

const wsLink = new GraphQLWsLink(
    createClient({
        url: `wss://${window.location.host}/api/v1/graphql`,
        connectionParams: { credentials: 'include' },
    }),
);

const splitLink = split(
    ({ query }) => {
        const def = getMainDefinition(query);
        return def.kind === 'OperationDefinition' && def.operation === 'subscription';
    },
    wsLink,
    httpLink,
);

export const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
});
