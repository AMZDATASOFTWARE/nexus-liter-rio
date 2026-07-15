import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import StoryPage from "@/pages/StoryPage";
import GraphPage from "@/pages/GraphPage";

export default function WorkspacePage() {
  const { id } = useParams();
  const { data: story } = useQuery({
    queryKey: ["story", id],
    queryFn: () => base44.entities.Story.get(id),
  });

  return (
    <div className="h-screen bg-[#08080f] flex flex-col lg:flex-row overflow-hidden">
      <div className="h-1/2 lg:h-full lg:w-1/2 overflow-y-auto border-b lg:border-b-0 lg:border-r border-zinc-900">
        <StoryPage storyIdProp={id} />
      </div>
      <div className="h-1/2 lg:h-full lg:w-1/2 min-h-0">
        {story?.universe_id ? (
          <GraphPage universeIdProp={story.universe_id} />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}