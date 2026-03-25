FROM langchain/langgraphjs-api:20

# Build this image from the monorepo root:
# docker build -f apps/agent/Dockerfile .
ADD . /deps/agent

ENV LANGSERVE_GRAPHS='{"ade-agent":"./apps/agent/src/agent/graph.ts:graph"}'
WORKDIR /deps/agent

RUN corepack enable && pnpm install --frozen-lockfile --filter @workspace/agent...
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts
