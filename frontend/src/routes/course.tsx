import { createFileRoute } from "@tanstack/react-router";
import {
  usePendingContentsPaginated,
  useApproveContent,
  useRejectContent,
} from "@/features/content/useContentData";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requireOnboardingCompleted } from "@/lib/auth";

function ReviewPage() {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const { data: response, isLoading, error } = usePendingContentsPaginated(page, pageSize);

  

  if (isLoading) {
    return <div className="p-8 text-center">Loading pending items...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error loading items: {error.message}</div>;
  }

  if (!response || response.content.length === 0) {
    return (
      <div className="p-8 text-center text-gray-600">
        <h2 className="text-xl font-semibold mb-2">No items to review</h2>
        <p>All pending items have been reviewed.</p>
      </div>
    );
  }

  const pendingContents = response.content;
  

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4  ">Courses</h1>
        

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-6 p-8">
            <Card key="CSD" className="group cursor-pointer h-64 border-2 border-gray-200 hover:border-blue-500 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-black-600">CS203 - Collaborative Software Development</h2>
              </div> 
            </Card>
            <Card key="CSD" className="group cursor-pointer h-64 border-2 border-gray-200 hover:border-blue-500 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-black-600">IS213 - Enterprise Solution Development</h2>
              </div> 
            </Card>
        </div>

        
      </div>
    </div>
  );
}

export const Route = createFileRoute("/course")({
  beforeLoad: requireOnboardingCompleted,
  component: ReviewPage,
});
