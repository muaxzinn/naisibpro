'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Archive, BookmarkCheck } from 'lucide-react';
import type { SubjectKey } from '@/lib/constants';
import type { SubTopicCatalogItem } from '@/lib/topic-catalog';
import { useProfileHistory } from '@/lib/use-profile-history';
import { useWorkspaceMode } from '@/components/WorkspaceModeProvider';
import { CatalogCompletedClient } from '@/components/CatalogCompletedClient';
import { CatalogReviewClient } from '@/components/CatalogReviewClient';

interface CatalogCompletedHubClientProps {
  practiceTopicsBySubject: Record<SubjectKey, SubTopicCatalogItem[]>;
  practiceTotalQuestions: number;
  realExamTopicsBySubject: Record<SubjectKey, SubTopicCatalogItem[]>;
  realExamTotalQuestions: number;
  allActiveTopicsBySubject: Record<SubjectKey, SubTopicCatalogItem[]>;
}

type HubTab = 'completed' | 'review';

export function CatalogCompletedHubClient({
  practiceTopicsBySubject,
  practiceTotalQuestions,
  realExamTopicsBySubject,
  realExamTotalQuestions,
  allActiveTopicsBySubject,
}: CatalogCompletedHubClientProps) {
  const searchParams = useSearchParams();
  const initialTab: HubTab = searchParams.get('tab') === 'review' ? 'review' : 'completed';
  const [tab, setTab] = useState<HubTab>(initialTab);

  const { workspaceMode } = useWorkspaceMode();
  const { allCompletedSet, realAttemptedSet, bookmarks } = useProfileHistory();

  useEffect(() => {
    if (searchParams.get('tab') === 'review') {
      setTab('review');
    } else if (searchParams.get('tab') === 'completed') {
      setTab('completed');
    }
  }, [searchParams]);

  const completedCount =
    workspaceMode === 'real-exam' ? realAttemptedSet.size : allCompletedSet.size;

  return (
    <div className="space-y-5">
      {/* Unified 2-Tab Bar: Completed History vs Personal Review Vault */}
      <div className="grid grid-cols-2 gap-2 rounded-card border border-line bg-panel p-2 shadow-card">
        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
            tab === 'completed'
              ? 'bg-brand text-white shadow-xs'
              : 'bg-bg2/60 text-ink hover:text-brand'
          }`}
        >
          <Archive className="h-4 w-4 shrink-0" />
          <span>ข้อสอบที่ทำแล้ว ({completedCount.toLocaleString()})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('review')}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
            tab === 'review'
              ? 'bg-gold text-ink shadow-xs'
              : 'bg-bg2/60 text-ink hover:text-gold-ink'
          }`}
        >
          <BookmarkCheck className="h-4 w-4 shrink-0" />
          <span>คลังทบทวนรายข้อ ({bookmarks.length.toLocaleString()})</span>
        </button>
      </div>

      {tab === 'completed' ? (
        <CatalogCompletedClient
          topicsBySubject={practiceTopicsBySubject}
          totalCatalogQuestions={practiceTotalQuestions}
          realExamTopicsBySubject={realExamTopicsBySubject}
          realExamTotalQuestions={realExamTotalQuestions}
        />
      ) : (
        <CatalogReviewClient topicsBySubject={allActiveTopicsBySubject} />
      )}
    </div>
  );
}
