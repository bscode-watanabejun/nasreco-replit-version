import { Switch, Route } from "wouter";
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
import UserInfo from "@/pages/user-info";
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
      <Route path="/landing" component={Landing} />
      
      {/* Protected routes */}
      {!isAuthenticated ? (
        <Route component={Landing} />
      ) : (
        <>
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
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
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
