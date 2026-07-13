import { gql, useQuery, useSubscription } from '@apollo/client';

const FLOWS_QUERY = gql`
    query Flows {
        flows {
            id
            title
            status
            createdAt
            description
        }
    }
`;

const FLOW_STATUS_SUB = gql`
    subscription FlowStatusChanged($flowId: ID!) {
        flowStatusChanged(flowId: $flowId) {
            id
            status
        }
    }
`;

const MESSAGES_QUERY = gql`
    query FlowMessages($flowId: ID!) {
        flowMessages(flowId: $flowId) {
            id
            message
            type
            agentType
            createdAt
        }
    }
`;

const MESSAGES_SUB = gql`
    subscription FlowMessages($flowId: ID!) {
        flowMessageCreated(flowId: $flowId) {
            id
            message
            type
            agentType
            createdAt
        }
    }
`;

export function useFlows() {
    return useQuery(FLOWS_QUERY, { pollInterval: 10000 });
}

export function useFlowStatus(flowId: string | null) {
    return useSubscription(FLOW_STATUS_SUB, {
        variables: { flowId },
        skip: !flowId,
    });
}

export function useFlowMessages(flowId: string | null) {
    const query = useQuery(MESSAGES_QUERY, {
        variables: { flowId },
        skip: !flowId,
        fetchPolicy: 'network-only',
    });
    const sub = useSubscription(MESSAGES_SUB, {
        variables: { flowId },
        skip: !flowId,
    });
    return { query, sub };
}
