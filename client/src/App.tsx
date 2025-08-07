import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CareRecords from "@/pages/care-records";
import NursingRecords from "@/pages/nursing-records";
import Vitals from "@/pages/vitals";
import MealsMedication from "@/pages/meals-medication";
import MedicationList from "@/pages/medication-list";
import UserInfo from "@/pages/user-info";
import Rounds from "@/pages/rounds";
import ManagementMenu from "@/pages/management-menu";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/care-records" component={CareRecords} />
          <Route path="/nursing-records" component={NursingRecords} />
          <Route path="/vitals" component={Vitals} />
          <Route path="/meals-medication" component={MealsMedication} />
          <Route path="/medication-list" component={MedicationList} />
          <Route path="/user-info" component={UserInfo} />
          <Route path="/rounds" component={Rounds} />
          <Route path="/management-menu" component={ManagementMenu} />
        </>
      )}
      <Route component={NotFound} />
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
