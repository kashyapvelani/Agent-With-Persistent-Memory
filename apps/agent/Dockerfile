FROM langchain/langgraphjs-api:20
ADD . /deps/agent
ENV LANGSERVE_GRAPHS='{"nexgenesis-agent":"./src/agent/graph.ts:graph"}'
WORKDIR /deps/agent
RUN pnpm install
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts