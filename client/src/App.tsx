import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CareRecords from "@/pages/care-records";
import Vitals from "@/pages/vitals";
import MealsMedication from "@/pages/meals-medication";
import MedicationList from "@/pages/medication-list";
import UserInfoView from "@/pages/user-info-view";
import UserInfoManagement from "@/pages/user-info-management";
import Rounds from "@/pages/rounds";
import ManagementMenu from "@/pages/management-menu";
import FacilitySettings from "@/pages/facility-settings";
import CommunicationManagement from "@/pages/communication-management";
import Communications from "@/pages/communications";
import CleaningLinenList from "@/pages/cleaning-linen-list";
import BathingList from "@/pages/bathing-list";
import WeightList from "@/pages/weight-list";
import ExcretionList from "@/pages/excretion-list";
import StaffManagement from "@/pages/staff-management";
import StaffLogin from "@/pages/staff-login";
import NursingRecordsList from "@/pages/nursing-records-list";
import NursingRecords from "@/pages/nursing-records";
import TreatmentList from "@/pages/treatment-list";
import DailyRecords from "@/pages/daily-records";
import NursingJournal from "@/pages/nursing-journal";
import CheckListMenu from "@/pages/check-list-menu";
import CareRecordsCheck from "@/pages/care-records-check";
import MealWaterCheckList from "@/pages/meal-water-check-list";
import ExcretionCheckList from "@/pages/excretion-check-list";
import BathingCheckList from "@/pages/bathing-check-list";
import MedicationCheckList from "@/pages/medication-check-list";
import VitalCheckList from "@/pages/vital-check-list";
import CleaningLinenCheckList from "@/pages/cleaning-linen-check-list";
import WeightCheckList from "@/pages/weight-check-list";
import RoundCheckList from "@/pages/round-check-list";
import JournalCheckList from "@/pages/journal-check-list";
import MultiTenantManagement from "@/pages/multi-tenant-management";
import MasterSettings from "@/pages/master-settings";
import { useAuth } from "@/hooks/useAuth";


function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/tenant/:tenantId/staff-login" component={StaffLogin} />
      <Route path="/landing" component={Landing} />

      {/* Protected routes - both parent and tenant environments */}
      {!isAuthenticated ? (
        <>
          {/* テナント環境の未認証時はスタッフログインへ */}
          <Route path="/tenant/:tenantId">
            {() => <StaffLogin />}
          </Route>
          <Route path="/tenant/:tenantId/*">
            {() => <StaffLogin />}
          </Route>
          <Route component={Landing} />
        </>
      ) : (
        <>
          {/* Tenant environment routes */}
          <Route path="/tenant/:tenantId" component={Dashboard} />
          <Route path="/tenant/:tenantId/care-records" component={CareRecords} />
          <Route path="/tenant/:tenantId/vitals" component={Vitals} />
          <Route path="/tenant/:tenantId/meals-medication" component={MealsMedication} />
          <Route path="/tenant/:tenantId/medication-list" component={MedicationList} />
          <Route path="/tenant/:tenantId/user-info" component={UserInfoView} />
          <Route path="/tenant/:tenantId/user-info-management" component={UserInfoManagement} />
          <Route path="/tenant/:tenantId/rounds" component={Rounds} />
          <Route path="/tenant/:tenantId/management-menu" component={ManagementMenu} />
          <Route path="/tenant/:tenantId/facility-settings" component={FacilitySettings} />
          <Route path="/tenant/:tenantId/communication-management" component={CommunicationManagement} />
          <Route path="/tenant/:tenantId/communications" component={Communications} />
          <Route path="/tenant/:tenantId/cleaning-linen-list" component={CleaningLinenList} />
          <Route path="/tenant/:tenantId/bathing-list" component={BathingList} />
          <Route path="/tenant/:tenantId/weight-list" component={WeightList} />
          <Route path="/tenant/:tenantId/excretion" component={ExcretionList} />
          <Route path="/tenant/:tenantId/nursing-records-list" component={NursingRecordsList} />
          <Route path="/tenant/:tenantId/nursing-records" component={NursingRecords} />
          <Route path="/tenant/:tenantId/staff-management" component={StaffManagement} />
          <Route path="/tenant/:tenantId/treatment-list" component={TreatmentList} />
          <Route path="/tenant/:tenantId/daily-records" component={DailyRecords} />
          <Route path="/tenant/:tenantId/nursing-journal" component={NursingJournal} />
          <Route path="/tenant/:tenantId/check-list-menu" component={CheckListMenu} />
          <Route path="/tenant/:tenantId/care-records-check" component={CareRecordsCheck} />
          <Route path="/tenant/:tenantId/meal-water-check-list" component={MealWaterCheckList} />
          <Route path="/tenant/:tenantId/excretion-check-list" component={ExcretionCheckList} />
          <Route path="/tenant/:tenantId/bathing-check-list" component={BathingCheckList} />
          <Route path="/tenant/:tenantId/medication-check-list" component={MedicationCheckList} />
          <Route path="/tenant/:tenantId/vital-check-list" component={VitalCheckList} />
          <Route path="/tenant/:tenantId/cleaning-linen-check-list" component={CleaningLinenCheckList} />
          <Route path="/tenant/:tenantId/weight-check-list" component={WeightCheckList} />
          <Route path="/tenant/:tenantId/round-check-list" component={RoundCheckList} />
          <Route path="/tenant/:tenantId/journal-check-list" component={JournalCheckList} />
          <Route path="/tenant/:tenantId/multi-tenant-management" component={MultiTenantManagement} />
          <Route path="/tenant/:tenantId/master-settings" component={MasterSettings} />

          {/* Parent environment routes */}
          <Route path="/" component={Dashboard} />
          <Route path="/care-records" component={CareRecords} />
          <Route path="/vitals" component={Vitals} />
          <Route path="/meals-medication" component={MealsMedication} />
          <Route path="/medication-list" component={MedicationList} />
          <Route path="/user-info" component={UserInfoView} />
          <Route path="/user-info-management" component={UserInfoManagement} />
          <Route path="/rounds" component={Rounds} />
          <Route path="/management-menu" component={ManagementMenu} />
          <Route path="/facility-settings" component={FacilitySettings} />
          <Route path="/communication-management" component={CommunicationManagement} />
          <Route path="/communications" component={Communications} />
          <Route path="/cleaning-linen-list" component={CleaningLinenList} />
          <Route path="/bathing-list" component={BathingList} />
          <Route path="/weight-list" component={WeightList} />
          <Route path="/excretion" component={ExcretionList} />
          <Route path="/nursing-records-list" component={NursingRecordsList} />
          <Route path="/nursing-records" component={NursingRecords} />
          <Route path="/staff-management" component={StaffManagement} />
          <Route path="/treatment-list" component={TreatmentList} />
          <Route path="/daily-records" component={DailyRecords} />
          <Route path="/nursing-journal" component={NursingJournal} />
          <Route path="/check-list-menu" component={CheckListMenu} />
          <Route path="/care-records-check" component={CareRecordsCheck} />
          <Route path="/meal-water-check-list" component={MealWaterCheckList} />
          <Route path="/excretion-check-list" component={ExcretionCheckList} />
          <Route path="/bathing-check-list" component={BathingCheckList} />
          <Route path="/medication-check-list" component={MedicationCheckList} />
          <Route path="/vital-check-list" component={VitalCheckList} />
          <Route path="/cleaning-linen-check-list" component={CleaningLinenCheckList} />
          <Route path="/weight-check-list" component={WeightCheckList} />
          <Route path="/round-check-list" component={RoundCheckList} />
          <Route path="/journal-check-list" component={JournalCheckList} />
          <Route path="/multi-tenant-management" component={MultiTenantManagement} />
          <Route path="/master-settings" component={MasterSettings} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  // スワイプリフレッシュ無効化
  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].pageY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].pageY;

      // スクロール可能な要素を探す
      let scrollElement = e.target as HTMLElement;
      let scrollTop = 0;

      while (scrollElement && scrollElement !== document.body) {
        if (scrollElement.scrollTop > 0) {
          scrollTop = scrollElement.scrollTop;
          break;
        }
        // overflow-y: autoまたはscrollの要素を探す
        const style = window.getComputedStyle(scrollElement);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          scrollTop = scrollElement.scrollTop;
          break;
        }
        scrollElement = scrollElement.parentElement as HTMLElement;
      }

      // どの要素もスクロールしていない場合はdocumentをチェック
      if (scrollTop === 0) {
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      }

      // ページ最上部で上にスワイプしようとしている場合のみ防ぐ
      if (scrollTop === 0 && y > startY) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
